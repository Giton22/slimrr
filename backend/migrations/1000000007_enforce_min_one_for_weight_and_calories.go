package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		if err := setNumberMin(app, "weight_entries", "weight_kg", true, 1.0, 999.0); err != nil {
			return err
		}
		if err := setNumberMin(app, "calorie_entries", "calories", false, 1.0, 99999.0); err != nil {
			return err
		}
		if err := setNumberMin(app, "calorie_entries", "goal_override_kcal", false, 1.0, 99999.0); err != nil {
			return err
		}
		if err := setNumberMin(app, "kcal_goal_history", "kcal", true, 1.0, 99999.0); err != nil {
			return err
		}
		return nil
	}, func(app core.App) error {
		if err := setNumberMin(app, "weight_entries", "weight_kg", true, 1.0, 999.0); err != nil {
			return err
		}
		if err := setNumberMin(app, "calorie_entries", "calories", false, 0.0, 99999.0); err != nil {
			return err
		}
		if err := setNumberMin(app, "calorie_entries", "goal_override_kcal", false, 0.0, 99999.0); err != nil {
			return err
		}
		if err := setNumberMin(app, "kcal_goal_history", "kcal", true, 0.0, 99999.0); err != nil {
			return err
		}
		return nil
	})
}

func setNumberMin(app core.App, collectionName, fieldName string, required bool, min, max float64) error {
	col, err := app.FindCollectionByNameOrId(collectionName)
	if err != nil {
		return err
	}

	col.Fields.RemoveByName(fieldName)
	col.Fields.Add(&core.NumberField{
		Name:     fieldName,
		Required: required,
		Min:      types.Pointer(min),
		Max:      types.Pointer(max),
	})

	return app.Save(col)
}
