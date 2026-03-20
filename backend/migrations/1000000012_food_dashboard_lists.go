package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		usersCollection, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}

		foodItems, err := app.FindCollectionByNameOrId("food_items")
		if err != nil {
			return err
		}

		foodFavorites := core.NewBaseCollection("food_favorites")
		foodFavorites.ListRule = types.Pointer("user = @request.auth.id")
		foodFavorites.ViewRule = types.Pointer("user = @request.auth.id")
		foodFavorites.CreateRule = types.Pointer(`@request.auth.id != ""`)
		foodFavorites.UpdateRule = types.Pointer("user = @request.auth.id")
		foodFavorites.DeleteRule = types.Pointer("user = @request.auth.id")
		foodFavorites.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.RelationField{
				Name:          "food_item",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  foodItems.Id,
				CascadeDelete: true,
			},
		)
		foodFavorites.AddIndex("idx_food_favorites_user_food_item", true, "user, food_item", "")
		if err := app.Save(foodFavorites); err != nil {
			return err
		}

		foodRecents := core.NewBaseCollection("food_recents")
		foodRecents.ListRule = types.Pointer("user = @request.auth.id")
		foodRecents.ViewRule = types.Pointer("user = @request.auth.id")
		foodRecents.CreateRule = types.Pointer(`@request.auth.id != ""`)
		foodRecents.UpdateRule = types.Pointer("user = @request.auth.id")
		foodRecents.DeleteRule = types.Pointer("user = @request.auth.id")
		foodRecents.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.RelationField{
				Name:          "food_item",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  foodItems.Id,
				CascadeDelete: true,
			},
			&core.AutodateField{
				Name:     "last_logged_at",
				OnCreate: true,
				OnUpdate: true,
			},
			&core.TextField{
				Name:     "last_logged_date",
				Required: true,
				Pattern:  `^\d{4}-\d{2}-\d{2}$`,
			},
			&core.SelectField{
				Name:      "last_meal_type",
				Required:  true,
				MaxSelect: 1,
				Values:    []string{"breakfast", "lunch", "dinner", "snack"},
			},
			&core.NumberField{
				Name:     "last_amount_g",
				Required: true,
				Min:      types.Pointer(1.0),
			},
			&core.NumberField{
				Name:     "times_logged",
				Required: true,
				Min:      types.Pointer(1.0),
			},
		)
		foodRecents.AddIndex("idx_food_recents_user_food_item", true, "user, food_item", "")
		foodRecents.AddIndex("idx_food_recents_user_last_logged_at", false, "user, last_logged_at", "")
		if err := app.Save(foodRecents); err != nil {
			return err
		}

		foodFrequent := core.NewBaseCollection("food_frequent")
		foodFrequent.ListRule = types.Pointer("user = @request.auth.id")
		foodFrequent.ViewRule = types.Pointer("user = @request.auth.id")
		foodFrequent.CreateRule = types.Pointer(`@request.auth.id != ""`)
		foodFrequent.UpdateRule = types.Pointer("user = @request.auth.id")
		foodFrequent.DeleteRule = types.Pointer("user = @request.auth.id")
		foodFrequent.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.RelationField{
				Name:          "food_item",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  foodItems.Id,
				CascadeDelete: true,
			},
			&core.AutodateField{
				Name:     "last_logged_at",
				OnCreate: true,
				OnUpdate: true,
			},
			&core.TextField{
				Name:     "last_logged_date",
				Required: true,
				Pattern:  `^\d{4}-\d{2}-\d{2}$`,
			},
			&core.SelectField{
				Name:      "last_meal_type",
				Required:  true,
				MaxSelect: 1,
				Values:    []string{"breakfast", "lunch", "dinner", "snack"},
			},
			&core.NumberField{
				Name:     "last_amount_g",
				Required: true,
				Min:      types.Pointer(1.0),
			},
			&core.NumberField{
				Name:     "times_logged",
				Required: true,
				Min:      types.Pointer(1.0),
			},
		)
		foodFrequent.AddIndex("idx_food_frequent_user_food_item", true, "user, food_item", "")
		foodFrequent.AddIndex("idx_food_frequent_user_sort", false, "user, times_logged, last_logged_at", "")
		return app.Save(foodFrequent)
	}, func(app core.App) error {
		for _, name := range []string{"food_frequent", "food_recents", "food_favorites"} {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			if err := app.Delete(col); err != nil {
				return err
			}
		}
		return nil
	})
}
