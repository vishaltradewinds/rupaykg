# 2026-10-31 17:14 UTC — evidence vault acceptance compile correction

- Evidence-vault/BWG integration test SHA `10ffb40e9b9257da763edb243c845210e26f38cc` ran as CI #4012 / `41222508107` and failed TypeScript only: shared fixture array type omitted `token`, although returned fixture contains it.
- Corrected shared fixture type to explicitly include `token: string` in SHA `0216ab466825eacd6fbb4a2c7a8a3738acffb878`.
- CI for corrected exact SHA is not yet visible/confirmed.
- No production changes. Continue exact-SHA CI until all gates finish; inspect any database acceptance failure and correct without weakening database triggers.
