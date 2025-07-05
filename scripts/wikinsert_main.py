import hashlib
import logging
import os
import re

import _md5
import pandas as pd
from dotenv import load_dotenv

from sentence_score import SentenceScorer
from wiki_mongo_db import WikiMongoDB
from wiki_sentence_utils import fetch_article_metadata, parse_article, fix_title

# --- Utility ---------------------------------------------------------------
LANGUAGE_CODES = {
    "en","de","fr","es","it","nl","pt","ru","ja","zh","ar","sv","pl","cs","fi",
    "no","da","ko","tr","he","uk","ca","hu","el","vi","id"
}

def extract_lang_from_filename(file_path: str) -> str:
    """
    Detect an ISO‑639‑1 language code that appears in the given file name.

    The function:
        1. Takes the basename of the path (ignoring directories).
        2. Removes the file extension.
        3. Splits the remaining name on underscores or hyphens.
        4. Returns the first token that matches a known language code.
        5. If no token matches, falls back to the first or last two‑letter token.

    Raises:
        ValueError if no plausible language code can be found.
    """
    base = os.path.basename(file_path)
    name, _ = os.path.splitext(base)
    tokens = re.split(r"[_\\-]", name)

    # Direct match against the curated list
    for tok in tokens:
        if tok in LANGUAGE_CODES:
            return tok

    # Fallback: any 2‑letter alphabetic token
    for tok in tokens:
        if len(tok) == 2 and tok.isalpha():
            return tok.lower()

    raise ValueError(f"Could not determine language from filename '{file_path}'")


class WikiPipeline:
    def __init__(self, mongo_uri=None, db_name=None):
        import os
        mongo_uri = mongo_uri or os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
        db_name = db_name or os.environ.get("DB_NAME", "wikinsert")
        # Load environment variables from .env file
        load_dotenv()
        # Paths to input parquet files; change these as needed
        self.source_path = os.environ.get("SOURCE_ARTICLES_PATH", "/path/to/source_articles.parquet")
        self.scored_path = os.environ.get("SCORED_DATA_PATH", "/path/to/score_data.parquet")
        MENTION_MAP_PATH = os.environ.get("MENTION_MAP_PATH", "/path/to/mention_map.parquet")
        MODEL_DIR = os.environ.get("MODEL_DIR", "/path/to/model_dir")
        self.db = WikiMongoDB(mongo_uri, db_name)
        self.scorer = SentenceScorer(MODEL_DIR, MENTION_MAP_PATH)


    def extract_article(self, lang, title, revid):
        """
        1) Check if article (lang, title, revid) is in the DB. If not or if 'force' is True:
           - Parse article
           - Save minimal article metadata to 'articles'
           - Save article sections to 'sections'
        2) Return the article_id (md5).
        """
        # Fix title for parsing
        title = fix_title(title)
        article_id = _md5.md5(f"{lang}{title}{revid}".encode()).hexdigest()

        article_meta_data = self.db.get_article_meta_data(article_id)
        if article_meta_data:
            logging.info(f"Article {lang}:{title}:{revid} already in DB (ID={article_id}). Skipping extraction.")
            return article_id

        article_data = parse_article(lang, title, revid)
        article_id = self.db.add_article_meta_data(lang, title, revid, article_data["thumbnail"],
                                                   article_data["description"])
        self.db.add_sections(article_id, article_data["sections"])
        return article_id

    def score_and_store(self, source_id, target_title, target_lead):
        """
        1) Check if there's an existing 'scores' document for (source_article_id, target_title).
        2) If needed, fetch sections of the source article, parse or load the target article to get
           relevant info (like lead section, if desired).
        3) Run scoring, store results in 'scores'.
        """
        # Fix title
        target_title = fix_title(target_title)
        # Check if scores already exist
        article_meta = self.db.get_article_meta_data(source_id)
        lang = article_meta["lang"]
        target_metadata = fetch_article_metadata(lang, target_title)

        target_id = self.db.add_target_meta(target_title, lang, target_lead, target_metadata["thumbnail"],
                                            target_metadata["description"])

        pair_id = hashlib.md5(f"{lang}{target_id}{source_id}".encode()).hexdigest()

        existing = self.db.get_scores(pair_id)
        if existing:
            logging.info(f"Scores for pair_id={pair_id} exist. Skipping.")
            return

        # Retrieve source sections:
        source_title = article_meta["title"]

        source_sections = self.db.get_sections(source_id)

        scores = self.scorer.get_sentence_scores(
            source_sections,
            source_title,
            target_title,
            target_lead,
        )
        # Save to DB
        self.db.add_scores(source_id, target_id, scores.to_dict('records'))
        self.db.update_article_targets(source_id, target_title)

    def full_pipeline_example(self):
        """
        Demonstration method:
        1) Extract some articles from a list.
        2) Then score pairs of those articles.
        """
        # Example articles to extract:
        articles_to_extract = [
            ("en", "Salmon", "1264244422"),
            ("en", "Bream", "1276814427"),
        ]
        # Extract each
        extracted_ids = []
        for (lang, title, revid) in articles_to_extract:
            article_id = self.extract_article(lang, title, revid)
            extracted_ids.append(article_id)

        # Let’s define a few pairs to score
        pairs_to_score = [
            # Pair the first article with the second, for example
            (extracted_ids[1], extracted_ids[0])
        ]

        for (source_id, target_id) in pairs_to_score:
            self.score_and_store(source_id, target_id, )

    def full_pipeline(self, testing):
        """
         Pipeline run:
        - Extract source articles from SOURCE_ARTICLES_PATH
        - Score pairs from SCORED_DATA_PATH
        """
        # Determine language from source file name
        lang = extract_lang_from_filename(self.source_path)
        # Load source articles
        df_sources = pd.read_parquet(self.source_path)
        # take only the first 20 for testing
        if testing:
            df_sources = df_sources.head(20)
            #df_sources = df_sources.sample(n=3, random_state=42)
        id_map = {}
        for _, row in df_sources.iterrows():
            title = fix_title(row['source_title'])
            revid = str(row['first_version'])
            src_id = self.extract_article(lang, title, revid)
            id_map[(title, revid)] = src_id
        # Load scoring data
        df_scores = pd.read_parquet(self.scored_path)
        # Process each unique source-target pair
        for _, row in df_scores[
            ['source_title', 'first_version', 'target_title', 'target_lead']].drop_duplicates().iterrows():
            src_title = fix_title(row['source_title'])
            src_rev = str(row['first_version'])
            src_id = id_map.get((src_title, src_rev))
            if not src_id:
                logging.warning(f"Source {src_title} rev {src_rev} not found; skipping.")
                continue
            tgt_title = row['target_title']
            tgt_lead = row['target_lead']
            self.score_and_store(src_id, tgt_title, tgt_lead)
            logging.info(f"Scored {src_title} (rev {src_rev}) against {tgt_title}.")

def main():
    logging.basicConfig(level=logging.INFO)
    pipeline = WikiPipeline()

    # Uncomment the line below to run the full pipeline with parquet files
    # pipeline.full_pipeline(testing=True)
    # logging.info("Finished testing")
    # withouth testing
    pipeline.full_pipeline(testing=False)


if __name__ == "__main__":
    main()
