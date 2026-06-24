import json

from samagra.factory.style import condition
from samagra.factory.style.profile import StyleSeed

SEED = StyleSeed(
    version=3,
    facets={
        "voice": {"mean_sentence_len": 12.0, "second_person_rate": 0.8,
                  "hedge_rate": 0.1, "len_mix": {"short": 0.6, "medium": 0.3, "long": 0.1},
                  "imperative_rate": 0.2, "n_sentences": 100},
        "sequencing": {"mean_sections_per_chapter": 9.0, "top_block_bigrams": []},
        "analogy": {"n_blocks": 50, "analogy_block_rate": 0.4},
        "rigor": {"flags_per_section": 1.2, "kind_mix": [["clarified", 1.0]]},
        "selection": {"equation_density": 0.3, "callout_density": 0.2,
                      "callout_variant_mix": [["key", 0.7], ["warn", 0.3]]},
    },
    source_corpus_hash="abc", created_at="t")


def test_prompt_names_the_version_and_all_facets():
    out = condition.to_system_prompt(SEED)
    assert "StyleSeed v3" in out
    for facet in ("voice", "sequencing", "analogy", "rigor", "selection"):
        assert facet in out.lower()


def test_prompt_embeds_the_canonical_facet_json_for_grounding():
    out = condition.to_system_prompt(SEED)
    # The raw facet stats are embedded so the LLM is conditioned on exact numbers,
    # not just prose. The marked block must round-trip to the facets.
    start = out.index("<facets>") + len("<facets>")
    end = out.index("</facets>")
    assert json.loads(out[start:end]) == SEED.facets


def test_prompt_surfaces_high_second_person_as_guidance():
    out = condition.to_system_prompt(SEED)
    assert "second person" in out.lower()   # 0.8 rate -> address-the-student guidance
