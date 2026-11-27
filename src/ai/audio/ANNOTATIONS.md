# Audio event review annotations

Annotations are independent human judgments. Rule-based transcript highlights
and audio candidates may be used to find timestamps, but they are not ground
truth until a reviewer watches the source recording.

Create a recording-specific empty document:

```bash
npm run audio:evaluate -- template /tmp/apex-annotations.json \
  --recording-id apex-legends --duration 1350.997312
```

Add reviewed intervals to that recording's `annotations` array:

```json
{
  "start": 145.0,
  "end": 178.0,
  "category": "combat",
  "description": "Optional factual description",
  "reviewerNotes": "Optional review notes",
  "keep": true,
  "confidence": "confirmed"
}
```

`category`, `description`, and `reviewerNotes` are optional. `keep` is
`true`, `false`, or `null`; `confidence` is `confirmed` or `uncertain`.
Evaluation uses only intervals where `keep` is `true` and confidence is
`confirmed`. This keeps ambiguous labels out of precision and recall.

Run evaluation after review:

```bash
npm run audio:evaluate -- evaluate /tmp/candidates.json \
  /tmp/apex-annotations.json /tmp/evaluation.json \
  --recording-id apex-legends
```

Matching maximizes total temporal IoU with one-to-one candidate/reference
assignments, then applies the configured minimum IoU. Do not tune detector
parameters and report final quality on the same small annotation set.
