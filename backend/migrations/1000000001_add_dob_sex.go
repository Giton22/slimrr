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

		col.Fields.Add(
			&core.TextField{
				Name:     "date_of_birth",
				Required: false,
				Pattern:  `^\d{4}-\d{2}-\d{2}$`,
			},
			&core.SelectField{
				Name:      "sex",
				Required:  false,
				MaxSelect: 1,
				Values:    []string{"male", "female"},
			},
		)

		return app.Save(col)
	}, func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("user_settings")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("date_of_birth")
		col.Fields.RemoveByName("sex")
		return app.Save(col)
	})
}
