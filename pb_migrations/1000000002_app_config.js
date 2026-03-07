/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // ── app_config ──
    // A single-row collection used to track whether first-run setup has been completed.
    // Anyone (unauthenticated) can read it so the frontend can detect first-launch.
    // Only authenticated users can update it (to mark setup as complete).
    // Nobody can create/delete via API — the seed record is created in this migration.
    const appConfig = new Collection({
      type: 'base',
      name: 'app_config',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: '@request.auth.id != ""',
      deleteRule: null,
      fields: [
        {
          name: 'setup_complete',
          type: 'bool',
          required: false,
        },
      ],
    })
    app.save(appConfig)

    // Seed the single config record
    const col = app.findCollectionByNameOrId('app_config')
    const record = new Record(col)
    record.set('setup_complete', false)
    app.save(record)
  },

  // ── down: drop app_config ──
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('app_config')
      app.delete(col)
    }
    catch (_) {
      // already gone
    }
  },
)
