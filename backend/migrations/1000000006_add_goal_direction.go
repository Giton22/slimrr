package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("user_settings")
		if err != nil {
			return err
		}

		col.Fields.Add(&core.SelectField{
			Name:      "goal_direction",
			Required:  false,
			MaxSelect: 1,
			Values:    []string{"loss", "gain"},
		})

		return app.Save(col)
	}, func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("user_settings")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("goal_direction")
		return app.Save(col)
	})
}
