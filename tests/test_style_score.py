from samagra.factory.style import score
from samagra.factory.style.profile import StyleSeed

# Profile: short sentences, very second-person, low hedging, frequent analogy.
SEED = StyleSeed(
    version=0,
    facets={
        "voice": {"mean_sentence_len": 6.0, "second_person_rate": 1.0, "hedge_rate": 0.0},
        "sequencing": {}, "analogy": {"analogy_block_rate": 1.0},
        "rigor": {}, "selection": {},
    },
    source_corpus_hash="h", created_at="t")


def test_style_fit_returns_overall_and_per_facet_in_unit_range():
    r = score.style_fit("You push it. You feel it. Imagine that.", SEED)
    assert set(r) == {"overall", "facets"}
    assert set(r["facets"]) == {"voice", "analogy"}
    for val in [r["overall"], *r["facets"].values()]:
        assert 0.0 <= val <= 1.0


def test_on_voice_a_conforming_text_scores_higher_than_a_divergent_one():
    conforming = "You push it. You feel it. You see it."          # short, 2nd-person
    divergent = ("The aforementioned phenomenon may perhaps generally be "
                 "considered approximately analogous to certain idealized regimes.")
    assert (score.style_fit(conforming, SEED)["facets"]["voice"]
            > score.style_fit(divergent, SEED)["facets"]["voice"])


def test_analogy_presence_matches_a_high_analogy_profile():
    with_analogy = score.style_fit("Imagine a ball on a string.", SEED)["facets"]["analogy"]
    without = score.style_fit("The tension equals the centripetal force.", SEED)["facets"]["analogy"]
    assert with_analogy > without
