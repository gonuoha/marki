# Syntax tour

Every construct Marki supports, in one document.

## Inline

Plain text with **strong**, _emphasis_, ~~strikethrough~~, `inline code`, a [link](https://commonmark.org), an autolink <https://spec.commonmark.org>, and inline math $e^{i\pi} + 1 = 0$.

## Blocks

### Code

```python
def sentence_boundaries(text: str) -> list[int]:
    """Yield offsets where a sentence ends, ignoring common abbreviations."""
    abbreviations = {"e.g.", "i.e.", "Mr.", "Dr.", "etc."}
    offsets = []
    for index, char in enumerate(text):
        if char not in ".?!":
            continue
        tail = text[max(0, index - 4) : index + 1]
        if any(tail.endswith(abbr) for abbr in abbreviations):
            continue
        offsets.append(index + 1)
    return offsets
```

### Quote

> A dinkus is the typographic mark — usually three asterisks — that separates one scene from the next.
>
> > It is not a dingus.

### Math

$$
\operatorname{measure}(w) = \min\left(w_{\max}, \frac{w_{\text{viewport}}}{1.6}\right)
$$

### Table

| Feature      | Status | Notes                          |
| :---         | :---:  | ---:                           |
| Tables       | done   | alignment survives round trips |
| Footnotes    | done   | definitions collect at the end |
| Front matter | done   | YAML, TOML and JSON            |

### Lists

1. First
2. Second
   1. Nested ordered
   2. Another
3. Third

- [ ] Unchecked task
- [x] Checked task

### Raw HTML

<div class="callout">
  <strong>Note:</strong> raw HTML blocks pass through untouched.
</div>

---

That's the whole surface area.
