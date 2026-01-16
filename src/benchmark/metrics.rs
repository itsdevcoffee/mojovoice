//! Word Error Rate (WER) and Character Error Rate (CER) calculations.

/// Normalize text for comparison: lowercase, remove punctuation, collapse whitespace.
pub fn normalize_text(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Calculate Word Error Rate using Levenshtein distance.
/// Returns (WER, substitutions, deletions, insertions).
pub fn word_error_rate(reference: &str, hypothesis: &str) -> (f64, usize, usize, usize) {
    let ref_normalized = normalize_text(reference);
    let hyp_normalized = normalize_text(hypothesis);

    let ref_words: Vec<&str> = ref_normalized.split_whitespace().collect();
    let hyp_words: Vec<&str> = hyp_normalized.split_whitespace().collect();

    if ref_words.is_empty() {
        return if hyp_words.is_empty() {
            (0.0, 0, 0, 0)
        } else {
            (1.0, 0, 0, hyp_words.len())
        };
    }

    let (distance, subs, dels, ins) = levenshtein_distance(&ref_words, &hyp_words);
    let wer = distance as f64 / ref_words.len() as f64;
    (wer, subs, dels, ins)
}

/// Calculate Character Error Rate using Levenshtein distance.
pub fn character_error_rate(reference: &str, hypothesis: &str) -> f64 {
    let ref_normalized = normalize_text(reference);
    let hyp_normalized = normalize_text(hypothesis);

    let ref_chars: Vec<char> = ref_normalized.chars().collect();
    let hyp_chars: Vec<char> = hyp_normalized.chars().collect();

    if ref_chars.is_empty() {
        return if hyp_chars.is_empty() { 0.0 } else { 1.0 };
    }

    let (distance, _, _, _) = levenshtein_distance(&ref_chars, &hyp_chars);
    distance as f64 / ref_chars.len() as f64
}

/// Check if normalized texts match exactly.
pub fn exact_match(reference: &str, hypothesis: &str) -> bool {
    normalize_text(reference) == normalize_text(hypothesis)
}

/// Generic Levenshtein distance calculation.
/// Returns (total_distance, substitutions, deletions, insertions).
fn levenshtein_distance<T: PartialEq>(a: &[T], b: &[T]) -> (usize, usize, usize, usize) {
    let m = a.len();
    let n = b.len();

    // dp[i][j] = (distance, subs, dels, ins) to transform a[0..i] to b[0..j]
    let mut dp = vec![vec![(0usize, 0usize, 0usize, 0usize); n + 1]; m + 1];

    // Base cases: empty string transformations
    for i in 1..=m {
        dp[i][0] = (i, 0, i, 0); // Delete i elements
    }
    for j in 1..=n {
        dp[0][j] = (j, 0, 0, j); // Insert j elements
    }

    for i in 1..=m {
        for j in 1..=n {
            if a[i - 1] == b[j - 1] {
                // Characters match, no operation needed
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                let sub = dp[i - 1][j - 1];
                let del = dp[i - 1][j];
                let ins = dp[i][j - 1];

                // Pick minimum distance operation
                if sub.0 <= del.0 && sub.0 <= ins.0 {
                    dp[i][j] = (sub.0 + 1, sub.1 + 1, sub.2, sub.3);
                } else if del.0 <= ins.0 {
                    dp[i][j] = (del.0 + 1, del.1, del.2 + 1, del.3);
                } else {
                    dp[i][j] = (ins.0 + 1, ins.1, ins.2, ins.3 + 1);
                }
            }
        }
    }

    dp[m][n]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_text() {
        assert_eq!(normalize_text("Hello, World!"), "hello world");
        assert_eq!(normalize_text("Testing 1, 2, 3"), "testing 1 2 3");
        assert_eq!(normalize_text("  extra   spaces  "), "extra spaces");
    }

    #[test]
    fn test_exact_match() {
        assert!(exact_match("Hello World", "hello world"));
        assert!(exact_match("Testing 1, 2, 3!", "testing 1 2 3"));
        assert!(!exact_match("hello", "world"));
    }

    #[test]
    fn test_wer_identical() {
        let (wer, _, _, _) = word_error_rate("the cat sat on the mat", "the cat sat on the mat");
        assert!((wer - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_wer_one_error() {
        // 1 substitution out of 6 words = 0.167
        let (wer, subs, _, _) = word_error_rate("the cat sat on the mat", "the dog sat on the mat");
        assert!((wer - 1.0 / 6.0).abs() < 0.001);
        assert_eq!(subs, 1);
    }

    #[test]
    fn test_cer_identical() {
        let cer = character_error_rate("hello", "hello");
        assert!((cer - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_cer_one_error() {
        // 1 substitution out of 5 chars = 0.2
        let cer = character_error_rate("hello", "hallo");
        assert!((cer - 0.2).abs() < 0.001);
    }
}
