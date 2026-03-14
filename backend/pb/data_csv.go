package pb

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

type csvDataType string

const (
	csvDataTypeWeight   csvDataType = "weight"
	csvDataTypeCalories csvDataType = "calories"
)

type csvImportError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type csvImportResult struct {
	Type      csvDataType      `json:"type"`
	TotalRows int              `json:"totalRows"`
	Created   int              `json:"created"`
	Updated   int              `json:"updated"`
	Skipped   int              `json:"skipped"`
	Errors    []csvImportError `json:"errors"`
}

func registerDataCsvRoutes(se *core.ServeEvent) {
	group := se.Router.Group("/api/data").Bind(apis.RequireAuth())

	group.POST("/import/csv", func(e *core.RequestEvent) error {
		dataType, err := parseCSVDataType(e.Request.FormValue("type"))
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}

		files, err := e.FindUploadedFiles("file")
		if err != nil || len(files) == 0 {
			return e.BadRequestError("missing file upload", nil)
		}

		reader, err := files[0].Reader.Open()
		if err != nil {
			return e.BadRequestError("invalid uploaded file", nil)
		}
		defer reader.Close()

		result, err := importCSV(e.App, e.Auth.Id, dataType, reader)
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}

		return e.JSON(http.StatusOK, result)
	})

	group.GET("/export/csv", func(e *core.RequestEvent) error {
		dataType, err := parseCSVDataType(e.Request.URL.Query().Get("type"))
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}

		csvBytes, err := exportCSV(e.App, e.Auth.Id, dataType)
		if err != nil {
			return e.InternalServerError("failed to export csv", err)
		}

		filename := fmt.Sprintf("%s-%s.csv", dataType, time.Now().Format("2006-01-02"))
		e.Response.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		e.Response.Header().Set("Cache-Control", "no-store")

		return e.Blob(http.StatusOK, "text/csv; charset=utf-8", csvBytes)
	})
}

func parseCSVDataType(raw string) (csvDataType, error) {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == string(csvDataTypeWeight) {
		return csvDataTypeWeight, nil
	}
	if v == string(csvDataTypeCalories) {
		return csvDataTypeCalories, nil
	}

	return "", errors.New("invalid type, expected one of: weight, calories")
}

func importCSV(app core.App, userID string, dataType csvDataType, r io.Reader) (*csvImportResult, error) {
	colName := "weight_entries"
	if dataType == csvDataTypeCalories {
		colName = "calorie_entries"
	}

	collection, err := app.FindCollectionByNameOrId(colName)
	if err != nil {
		return nil, err
	}

	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1

	headers, err := cr.Read()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil, errors.New("empty csv file")
		}
		return nil, fmt.Errorf("failed reading csv headers: %w", err)
	}

	headerIndex := normalizeCSVHeader(headers)
	if err := validateCSVHeaders(dataType, headerIndex); err != nil {
		return nil, err
	}

	result := &csvImportResult{Type: dataType, Errors: []csvImportError{}}
	lineNum := 1

	for {
		record, err := cr.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		lineNum++
		if err != nil {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "invalid csv row"})
			continue
		}

		if isCSVRowEmpty(record) {
			result.Skipped++
			continue
		}

		result.TotalRows++

		date := csvCell(record, headerIndex, "date")
		if !isDateISO(date) {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "date must be YYYY-MM-DD"})
			continue
		}

		if dataType == csvDataTypeWeight {
			weight, parseErr := parseRequiredFloat(csvCell(record, headerIndex, "weight_kg"))
			if parseErr != nil {
				result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "weight_kg must be a number"})
				continue
			}
			if weight < 1 || weight > 999 {
				result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "weight_kg must be between 1 and 999"})
				continue
			}

			note := csvCell(record, headerIndex, "note")
			if len(note) > 500 {
				result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "note exceeds max length of 500"})
				continue
			}

			created, upsertErr := upsertWeightRecord(app, collection, userID, date, weight, note)
			if upsertErr != nil {
				result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "failed to save weight row"})
				continue
			}

			if created {
				result.Created++
			} else {
				result.Updated++
			}

			continue
		}

		calories, caloriesErr := parseOptionalFloat(csvCell(record, headerIndex, "calories"))
		goalOverride, goalErr := parseOptionalFloat(csvCell(record, headerIndex, "goal_override_kcal"))
		if caloriesErr != nil {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "calories must be a number"})
			continue
		}
		if goalErr != nil {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "goal_override_kcal must be a number"})
			continue
		}

		if calories == nil && goalOverride == nil {
			result.Skipped++
			continue
		}

		if calories != nil && (*calories < 1 || *calories > 99999) {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "calories must be between 1 and 99999"})
			continue
		}
		if goalOverride != nil && (*goalOverride < 1 || *goalOverride > 99999) {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "goal_override_kcal must be between 1 and 99999"})
			continue
		}

		note := csvCell(record, headerIndex, "note")
		if len(note) > 500 {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "note exceeds max length of 500"})
			continue
		}

		created, upsertErr := upsertCalorieRecord(app, collection, userID, date, calories, goalOverride, note)
		if upsertErr != nil {
			result.Errors = append(result.Errors, csvImportError{Row: lineNum, Message: "failed to save calorie row"})
			continue
		}

		if created {
			result.Created++
		} else {
			result.Updated++
		}
	}

	return result, nil
}

func exportCSV(app core.App, userID string, dataType csvDataType) ([]byte, error) {
	var (
		headers []string
		records []*core.Record
		err     error
	)

	if dataType == csvDataTypeWeight {
		headers = []string{"date", "weight_kg", "note"}
		records, err = app.FindRecordsByFilter(
			"weight_entries",
			"user = {:userId}",
			"date",
			0,
			0,
			dbx.Params{"userId": userID},
		)
	} else {
		headers = []string{"date", "calories", "goal_override_kcal", "note"}
		records, err = app.FindRecordsByFilter(
			"calorie_entries",
			"user = {:userId}",
			"date",
			0,
			0,
			dbx.Params{"userId": userID},
		)
	}
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	buf.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(buf)
	w.UseCRLF = true

	if err := w.Write(headers); err != nil {
		return nil, err
	}

	for _, rec := range records {
		if dataType == csvDataTypeWeight {
			if err := w.Write([]string{
				rec.GetString("date"),
				formatFloat(rec.GetFloat("weight_kg")),
				rec.GetString("note"),
			}); err != nil {
				return nil, err
			}
			continue
		}

		calories := rec.GetFloat("calories")
		goalOverride := rec.GetFloat("goal_override_kcal")

		if err := w.Write([]string{
			rec.GetString("date"),
			optionalFloatToString(calories),
			optionalFloatToString(goalOverride),
			rec.GetString("note"),
		}); err != nil {
			return nil, err
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func normalizeCSVHeader(headers []string) map[string]int {
	idx := map[string]int{}
	for i, raw := range headers {
		normalized := strings.ToLower(strings.TrimSpace(raw))
		normalized = strings.TrimPrefix(normalized, "\ufeff")
		idx[normalized] = i
	}
	return idx
}

func validateCSVHeaders(dataType csvDataType, headerIdx map[string]int) error {
	required := []string{"date"}
	if dataType == csvDataTypeWeight {
		required = append(required, "weight_kg")
	}

	for _, h := range required {
		if _, ok := headerIdx[h]; !ok {
			return fmt.Errorf("missing required header: %s", h)
		}
	}

	if dataType == csvDataTypeCalories {
		_, hasCalories := headerIdx["calories"]
		_, hasGoal := headerIdx["goal_override_kcal"]
		if !hasCalories && !hasGoal {
			return errors.New("calories csv must include at least one header: calories or goal_override_kcal")
		}
	}

	return nil
}

func csvCell(record []string, idx map[string]int, key string) string {
	i, ok := idx[key]
	if !ok || i < 0 || i >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[i])
}

func isCSVRowEmpty(record []string) bool {
	for _, cell := range record {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func parseRequiredFloat(raw string) (float64, error) {
	if strings.TrimSpace(raw) == "" {
		return 0, errors.New("required value is missing")
	}
	return strconv.ParseFloat(raw, 64)
}

func parseOptionalFloat(raw string) (*float64, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return nil, err
	}
	if v == 0 {
		return nil, nil
	}
	return &v, nil
}

func isDateISO(raw string) bool {
	if len(raw) != len("2006-01-02") {
		return false
	}
	_, err := time.Parse("2006-01-02", raw)
	return err == nil
}

func upsertWeightRecord(app core.App, collection *core.Collection, userID, date string, weight float64, note string) (bool, error) {
	existing, err := app.FindFirstRecordByFilter(
		collection,
		"user = {:userId} && date = {:date}",
		dbx.Params{"userId": userID, "date": date},
	)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}

	if existing != nil {
		existing.Set("weight_kg", weight)
		existing.Set("note", note)
		return false, app.Save(existing)
	}

	rec := core.NewRecord(collection)
	rec.Set("user", userID)
	rec.Set("date", date)
	rec.Set("weight_kg", weight)
	rec.Set("note", note)

	return true, app.Save(rec)
}

func upsertCalorieRecord(app core.App, collection *core.Collection, userID, date string, calories, goalOverride *float64, note string) (bool, error) {
	existing, err := app.FindFirstRecordByFilter(
		collection,
		"user = {:userId} && date = {:date}",
		dbx.Params{"userId": userID, "date": date},
	)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}

	if existing != nil {
		existing.Set("calories", calories)
		existing.Set("goal_override_kcal", goalOverride)
		existing.Set("note", note)
		return false, app.Save(existing)
	}

	rec := core.NewRecord(collection)
	rec.Set("user", userID)
	rec.Set("date", date)
	rec.Set("calories", calories)
	rec.Set("goal_override_kcal", goalOverride)
	rec.Set("note", note)

	return true, app.Save(rec)
}

func formatFloat(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

func optionalFloatToString(v float64) string {
	if v <= 0 {
		return ""
	}
	return formatFloat(v)
}
