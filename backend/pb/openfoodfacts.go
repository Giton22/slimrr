package pb

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

type normalizedProduct struct {
	Barcode         string  `json:"barcode"`
	Name            string  `json:"name"`
	Brand           string  `json:"brand"`
	CaloriesPer100g float64 `json:"caloriesPer100g"`
	ProteinPer100g  float64 `json:"proteinPer100g"`
	CarbsPer100g    float64 `json:"carbsPer100g"`
	FatPer100g      float64 `json:"fatPer100g"`
	ServingG        float64 `json:"servingG"`
	OffId           string  `json:"offId"`
	NutritionPer    float64 `json:"nutritionPer,omitempty"`
}

type cacheEntry struct {
	data      any
	expiresAt time.Time
}

var (
	offCache   = map[string]cacheEntry{}
	offCacheMu sync.RWMutex
	cacheTTL   = 15 * time.Minute
	httpClient = &http.Client{Timeout: 15 * time.Second}
)

func cacheGet(key string) (any, bool) {
	offCacheMu.RLock()
	defer offCacheMu.RUnlock()
	entry, ok := offCache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func cacheSet(key string, data any) {
	offCacheMu.Lock()
	defer offCacheMu.Unlock()
	offCache[key] = cacheEntry{data: data, expiresAt: time.Now().Add(cacheTTL)}

	// Evict expired entries if cache grows large
	if len(offCache) > 500 {
		now := time.Now()
		for k, v := range offCache {
			if now.After(v.expiresAt) {
				delete(offCache, k)
			}
		}
	}
}

func registerFoodApiRoutes(se *core.ServeEvent) {
	group := se.Router.Group("/api/food").Bind(apis.RequireAuth())

	group.GET("/search", func(e *core.RequestEvent) error {
		query := e.Request.URL.Query().Get("q")
		if query == "" {
			return e.BadRequestError("missing query parameter 'q'", nil)
		}

		page := e.Request.URL.Query().Get("page")
		if page == "" {
			page = "1"
		}

		cacheKey := fmt.Sprintf("search:%s:%s", query, page)
		if cached, ok := cacheGet(cacheKey); ok {
			return e.JSON(http.StatusOK, cached)
		}

		params := url.Values{}
		params.Set("q", query)
		params.Set("page", page)
		params.Set("page_size", "24")
		params.Set("fields", "code,product_name,brands,nutriments,serving_quantity")

		offURL := "https://search.openfoodfacts.org/search?" + params.Encode()

		req, err := http.NewRequestWithContext(e.Request.Context(), "GET", offURL, nil)
		if err != nil {
			return e.InternalServerError("failed to create request", err)
		}
		req.Header.Set("User-Agent", "bodyweight-tracker/1.0 (food search)")

		resp, err := httpClient.Do(req)
		if err != nil {
			return e.InternalServerError("failed to fetch from OpenFoodFacts", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return e.InternalServerError("failed to read response", err)
		}

		var raw struct {
			Hits []struct {
				Code            string   `json:"code"`
				ProductName     string   `json:"product_name"`
				Brands          []string `json:"brands"`
				ServingQuantity any      `json:"serving_quantity"`
				Nutriments      struct {
					EnergyKcal100g float64 `json:"energy-kcal_100g"`
					Proteins100g   float64 `json:"proteins_100g"`
					Carbs100g      float64 `json:"carbohydrates_100g"`
					Fat100g        float64 `json:"fat_100g"`
				} `json:"nutriments"`
			} `json:"hits"`
		}
		if err := json.Unmarshal(body, &raw); err != nil {
			return e.InternalServerError("failed to parse response", err)
		}

		var results []normalizedProduct
		for _, p := range raw.Hits {
			if p.Nutriments.EnergyKcal100g <= 0 || p.ProductName == "" {
				continue
			}
			servingG := parseServingQuantity(p.ServingQuantity)
			results = append(results, normalizedProduct{
				Barcode:         p.Code,
				Name:            p.ProductName,
				Brand:           strings.Join(p.Brands, ", "),
				CaloriesPer100g: roundTo1(p.Nutriments.EnergyKcal100g),
				ProteinPer100g:  roundTo1(p.Nutriments.Proteins100g),
				CarbsPer100g:    roundTo1(p.Nutriments.Carbs100g),
				FatPer100g:      roundTo1(p.Nutriments.Fat100g),
				ServingG:        servingG,
				OffId:           p.Code,
			})
		}

		if results == nil {
			results = []normalizedProduct{}
		}

		cacheSet(cacheKey, results)
		return e.JSON(http.StatusOK, results)
	})

	group.GET("/barcode/{code}", func(e *core.RequestEvent) error {
		code := e.Request.PathValue("code")
		if code == "" {
			return e.BadRequestError("missing barcode code", nil)
		}

		cacheKey := fmt.Sprintf("barcode:%s", code)
		if cached, ok := cacheGet(cacheKey); ok {
			return e.JSON(http.StatusOK, cached)
		}

		offURL := fmt.Sprintf("https://world.openfoodfacts.org/api/v2/product/%s.json?fields=code,product_name,brands,nutriments,serving_quantity", url.PathEscape(code))

		req, err := http.NewRequestWithContext(e.Request.Context(), "GET", offURL, nil)
		if err != nil {
			return e.InternalServerError("failed to create request", err)
		}
		req.Header.Set("User-Agent", "bodyweight-tracker/1.0 (barcode lookup)")

		resp, err := httpClient.Do(req)
		if err != nil {
			return e.InternalServerError("failed to fetch from OpenFoodFacts", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return e.InternalServerError("failed to read response", err)
		}

		var raw struct {
			Status  int `json:"status"`
			Product struct {
				Code            string `json:"code"`
				ProductName     string `json:"product_name"`
				Brands          string `json:"brands"`
				ServingQuantity any    `json:"serving_quantity"`
				Nutriments      struct {
					EnergyKcal100g float64 `json:"energy-kcal_100g"`
					Proteins100g   float64 `json:"proteins_100g"`
					Carbs100g      float64 `json:"carbohydrates_100g"`
					Fat100g        float64 `json:"fat_100g"`
				} `json:"nutriments"`
			} `json:"product"`
		}
		if err := json.Unmarshal(body, &raw); err != nil {
			return e.InternalServerError("failed to parse response", err)
		}

		if raw.Status != 1 || raw.Product.ProductName == "" || raw.Product.Nutriments.EnergyKcal100g <= 0 {
			return e.NotFoundError("product not found or missing nutritional data", nil)
		}

		servingG := parseServingQuantity(raw.Product.ServingQuantity)
		result := normalizedProduct{
			Barcode:         raw.Product.Code,
			Name:            raw.Product.ProductName,
			Brand:           raw.Product.Brands,
			CaloriesPer100g: roundTo1(raw.Product.Nutriments.EnergyKcal100g),
			ProteinPer100g:  roundTo1(raw.Product.Nutriments.Proteins100g),
			CarbsPer100g:    roundTo1(raw.Product.Nutriments.Carbs100g),
			FatPer100g:      roundTo1(raw.Product.Nutriments.Fat100g),
			ServingG:        servingG,
			OffId:           raw.Product.Code,
		}

		cacheSet(cacheKey, result)
		return e.JSON(http.StatusOK, result)
	})

	// ── Vision label scanning ──

	group.GET("/label/status", func(e *core.RequestEvent) error {
		apiURL := os.Getenv("VISION_API_URL")
		apiKey := os.Getenv("VISION_API_KEY")
		model := os.Getenv("VISION_MODEL")
		configured := apiURL != "" && apiKey != "" && model != ""
		return e.JSON(http.StatusOK, map[string]bool{"configured": configured})
	})

	group.POST("/label", func(e *core.RequestEvent) error {
		apiURL := os.Getenv("VISION_API_URL")
		apiKey := os.Getenv("VISION_API_KEY")
		model := os.Getenv("VISION_MODEL")

		if apiURL == "" || apiKey == "" || model == "" {
			return e.JSON(http.StatusNotImplemented, map[string]string{
				"message": "Vision API not configured",
			})
		}

		file, header, err := e.Request.FormFile("image")
		if err != nil {
			return e.BadRequestError("missing 'image' file field", err)
		}
		defer file.Close()

		imageBytes, err := io.ReadAll(io.LimitReader(file, 20<<20)) // 20MB limit
		if err != nil {
			return e.InternalServerError("failed to read image", err)
		}

		// Detect MIME type from file extension
		mimeType := "image/jpeg"
		name := strings.ToLower(header.Filename)
		if strings.HasSuffix(name, ".png") {
			mimeType = "image/png"
		} else if strings.HasSuffix(name, ".webp") {
			mimeType = "image/webp"
		} else if strings.HasSuffix(name, ".gif") {
			mimeType = "image/gif"
		}

		dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(imageBytes))

		// Build OpenAI-compatible chat completion request
		chatReq := map[string]any{
			"model": model,
			"messages": []map[string]any{
				{
					"role": "system",
					"content": `You are a nutrition label parser. Extract nutrition data from the food label image.
Return ONLY valid JSON with these fields:
{
  "name": "product name if visible, otherwise 'Unknown Product'",
  "brand": "brand if visible, otherwise empty string",
  "nutritionPer": <number, the reference amount in grams the values are given for, e.g. 100 for "per 100g", 25 for "per 25g", 30 for "per 30g">,
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "fat": <number>,
  "servingG": <number, the serving size in grams if shown separately from nutritionPer>
}
Report values EXACTLY as they appear on the label. Do NOT convert to per 100g.
If a value cannot be determined, use 0.`,
				},
				{
					"role": "user",
					"content": []map[string]any{
						{
							"type": "image_url",
							"image_url": map[string]string{
								"url": dataURI,
							},
						},
						{
							"type": "text",
							"text": "Extract nutrition facts from this label.",
						},
					},
				},
			},
			"max_tokens": 500,
		}

		chatBody, err := json.Marshal(chatReq)
		if err != nil {
			return e.InternalServerError("failed to build vision request", err)
		}

		endpoint := strings.TrimRight(apiURL, "/") + "/chat/completions"
		visionReq, err := http.NewRequestWithContext(e.Request.Context(), "POST", endpoint, bytes.NewReader(chatBody))
		if err != nil {
			return e.InternalServerError("failed to create vision request", err)
		}
		visionReq.Header.Set("Content-Type", "application/json")
		visionReq.Header.Set("Authorization", "Bearer "+apiKey)

		visionClient := &http.Client{Timeout: 60 * time.Second}
		resp, err := visionClient.Do(visionReq)
		if err != nil {
			return e.InternalServerError("vision API request failed", err)
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return e.InternalServerError("failed to read vision response", err)
		}

		if resp.StatusCode != http.StatusOK {
			return e.InternalServerError(
				fmt.Sprintf("vision API returned status %d: %s", resp.StatusCode, string(respBody)),
				nil,
			)
		}

		// Parse OpenAI-compatible response
		var chatResp struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal(respBody, &chatResp); err != nil {
			return e.InternalServerError("failed to parse vision response", err)
		}

		if len(chatResp.Choices) == 0 {
			return e.InternalServerError("vision API returned no choices", nil)
		}

		content := chatResp.Choices[0].Message.Content

		// Strip markdown code fences if present
		content = strings.TrimSpace(content)
		if strings.HasPrefix(content, "```") {
			lines := strings.Split(content, "\n")
			// Remove first and last lines (code fences)
			if len(lines) > 2 {
				content = strings.Join(lines[1:len(lines)-1], "\n")
			}
		}

		var parsed struct {
			Name         string  `json:"name"`
			Brand        string  `json:"brand"`
			NutritionPer float64 `json:"nutritionPer"`
			Calories     float64 `json:"calories"`
			Protein      float64 `json:"protein"`
			Carbs        float64 `json:"carbs"`
			Fat          float64 `json:"fat"`
			ServingG     float64 `json:"servingG"`
		}
		if err := json.Unmarshal([]byte(content), &parsed); err != nil {
			return e.InternalServerError("failed to parse nutrition data from AI response", err)
		}

		if parsed.Name == "" {
			parsed.Name = "Unknown Product"
		}
		if parsed.NutritionPer <= 0 {
			parsed.NutritionPer = 100
		}
		if parsed.ServingG <= 0 {
			parsed.ServingG = parsed.NutritionPer
		}

		factor := 100.0 / parsed.NutritionPer
		result := normalizedProduct{
			Name:            parsed.Name,
			Brand:           parsed.Brand,
			CaloriesPer100g: roundTo1(parsed.Calories * factor),
			ProteinPer100g:  roundTo1(parsed.Protein * factor),
			CarbsPer100g:    roundTo1(parsed.Carbs * factor),
			FatPer100g:      roundTo1(parsed.Fat * factor),
			ServingG:        parsed.ServingG,
		}
		if parsed.NutritionPer != 100 {
			result.NutritionPer = parsed.NutritionPer
		}

		return e.JSON(http.StatusOK, result)
	})
}

func roundTo1(v float64) float64 {
	return math.Round(v*10) / 10
}

func parseServingQuantity(v any) float64 {
	switch val := v.(type) {
	case float64:
		if val > 0 {
			return val
		}
	case string:
		// Some products have serving_quantity as string
		var f float64
		if _, err := fmt.Sscanf(val, "%f", &f); err == nil && f > 0 {
			return f
		}
	}
	return 100
}
