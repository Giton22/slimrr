package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		usersCollection, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}

		// ── weight_entries ──
		weightEntries := core.NewBaseCollection("weight_entries")
		weightEntries.ListRule = types.Pointer("user = @request.auth.id")
		weightEntries.ViewRule = types.Pointer("user = @request.auth.id")
		weightEntries.CreateRule = types.Pointer(`@request.auth.id != ""`)
		weightEntries.UpdateRule = types.Pointer("user = @request.auth.id")
		weightEntries.DeleteRule = types.Pointer("user = @request.auth.id")
		weightEntries.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.TextField{
				Name:     "date",
				Required: true,
				Pattern:  `^\d{4}-\d{2}-\d{2}$`,
			},
			&core.NumberField{
				Name:     "weight_kg",
				Required: true,
				Min:      types.Pointer(1.0),
				Max:      types.Pointer(999.0),
			},
			&core.TextField{
				Name:     "note",
				Required: false,
				Max:      500,
			},
		)
		weightEntries.AddIndex("idx_weight_entries_user_date", true, "user, date", "")
		if err := app.Save(weightEntries); err != nil {
			return err
		}

		// ── calorie_entries ──
		calorieEntries := core.NewBaseCollection("calorie_entries")
		calorieEntries.ListRule = types.Pointer("user = @request.auth.id")
		calorieEntries.ViewRule = types.Pointer("user = @request.auth.id")
		calorieEntries.CreateRule = types.Pointer(`@request.auth.id != ""`)
		calorieEntries.UpdateRule = types.Pointer("user = @request.auth.id")
		calorieEntries.DeleteRule = types.Pointer("user = @request.auth.id")
		calorieEntries.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.TextField{
				Name:     "date",
				Required: true,
				Pattern:  `^\d{4}-\d{2}-\d{2}$`,
			},
			&core.NumberField{
				Name:     "calories",
				Required: false,
				Min:      types.Pointer(0.0),
				Max:      types.Pointer(99999.0),
			},
			&core.NumberField{
				Name:     "goal_override_kcal",
				Required: false,
				Min:      types.Pointer(0.0),
				Max:      types.Pointer(99999.0),
			},
			&core.TextField{
				Name:     "note",
				Required: false,
				Max:      500,
			},
		)
		calorieEntries.AddIndex("idx_calorie_entries_user_date", true, "user, date", "")
		if err := app.Save(calorieEntries); err != nil {
			return err
		}

		// ── kcal_goal_history ──
		kcalGoalHistory := core.NewBaseCollection("kcal_goal_history")
		kcalGoalHistory.ListRule = types.Pointer("user = @request.auth.id")
		kcalGoalHistory.ViewRule = types.Pointer("user = @request.auth.id")
		kcalGoalHistory.CreateRule = types.Pointer(`@request.auth.id != ""`)
		kcalGoalHistory.UpdateRule = types.Pointer("user = @request.auth.id")
		kcalGoalHistory.DeleteRule = types.Pointer("user = @request.auth.id")
		kcalGoalHistory.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.TextField{
				Name:     "effective_from",
				Required: true,
				Pattern:  `^\d{4}-\d{2}-\d{2}$`,
			},
			&core.NumberField{
				Name:     "kcal",
				Required: true,
				Min:      types.Pointer(0.0),
				Max:      types.Pointer(99999.0),
			},
		)
		kcalGoalHistory.AddIndex("idx_kcal_goal_history_user_date", true, "user, effective_from", "")
		if err := app.Save(kcalGoalHistory); err != nil {
			return err
		}

		// ── user_settings ──
		userSettings := core.NewBaseCollection("user_settings")
		userSettings.ListRule = types.Pointer("user = @request.auth.id")
		userSettings.ViewRule = types.Pointer("user = @request.auth.id")
		userSettings.CreateRule = types.Pointer(`@request.auth.id != ""`)
		userSettings.UpdateRule = types.Pointer("user = @request.auth.id")
		userSettings.DeleteRule = types.Pointer("user = @request.auth.id")
		userSettings.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.SelectField{
				Name:      "unit",
				Required:  true,
				MaxSelect: 1,
				Values:    []string{"kg", "lbs"},
			},
			&core.NumberField{
				Name:     "goal_weight_kg",
				Required: false,
				Min:      types.Pointer(1.0),
				Max:      types.Pointer(999.0),
			},
			&core.NumberField{
				Name:     "height_cm",
				Required: false,
				Min:      types.Pointer(1.0),
				Max:      types.Pointer(300.0),
			},
		)
		userSettings.AddIndex("idx_user_settings_user", true, "user", "")
		return app.Save(userSettings)
	}, func(app core.App) error {
		for _, name := range []string{"user_settings", "kcal_goal_history", "calorie_entries", "weight_entries"} {
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
