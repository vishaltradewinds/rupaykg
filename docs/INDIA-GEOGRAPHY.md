# India Geography Model

The model must support India without assuming one fixed administrative hierarchy.

```text
India
  -> State / Union Territory
     -> District
        -> Sub-district / Block / Taluk / Tehsil
           -> Local operating jurisdiction
              -> Urban: Municipal Corporation / Municipality / Nagar Panchayat / Ward / locality
              -> Rural: Gram Panchayat / village / habitation / cluster
```

## Rules
- Geography is versioned because administrative boundaries can change.
- Every operational record may carry an effective geography scope.
- Rural and urban infrastructure can differ while using common domain entities.
- A record may reference source geography and destination geography.
- Permissions are scoped by organization and geography.
- LGD or another authoritative government geography source must be treated as an external authority, not fabricated platform data.
