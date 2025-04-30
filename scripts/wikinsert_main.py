import hashlib
import logging
import os

import _md5
import pandas as pd
from python_dotenv import load_dotenv

from scripts.wiki_sentence_utils import fetch_article_metadata

# Load environment variables from .env file
load_dotenv()

# Paths to input parquet files; change these as needed
SOURCE_ARTICLES_PATH = os.environ.get("SOURCE_ARTICLES_PATH", "/path/to/source_articles.parquet")
SCORED_DATA_PATH = os.environ.get("SCORED_DATA_PATH", "/path/to/score_data.parquet")
MENTION_MAP_PATH = os.environ.get("MENTION_MAP_PATH", "/path/to/mention_map.parquet")
MODEL_DIR = os.environ.get("MODEL_DIR", "/path/to/model_dir")

from sentence_score import get_sentence_scores
from wiki_mongo_db import WikiMongoDB
from wiki_sentence_utils import parse_article


class WikiPipeline:
    def __init__(self, mongo_uri=None, db_name=None):
        import os
        mongo_uri = mongo_uri or os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
        db_name = db_name or os.environ.get("DB_NAME", "wikinsert")
        self.db = WikiMongoDB(mongo_uri, db_name)

    def extract_article(self, lang, title, revid):
        """
        1) Check if article (lang, title, revid) is in the DB. If not or if 'force' is True:
           - Parse article
           - Save minimal article metadata to 'articles'
           - Save article sections to 'sections'
        2) Return the article_id (md5).
        """
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

        scores = get_sentence_scores(
            source_sections,
            source_title,
            target_title,
            target_lead,
            model_dir=MODEL_DIR,
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
            lower_case_title = title.lower()
            article_id = self.extract_article(lang, lower_case_title, revid)
            extracted_ids.append(article_id)

        # Let’s define a few pairs to score
        pairs_to_score = [
            # Pair the first article with the second, for example
            (extracted_ids[1], extracted_ids[0])
        ]
        for (source_id, target_id) in pairs_to_score:
            self.score_and_store(source_id, target_id, )

    def full_pipeline(self):
        """
         Pipeline run:
        - Extract source articles from SOURCE_ARTICLES_PATH
        - Score pairs from SCORED_DATA_PATH
        """
        # Determine language from source file name
        lang = os.path.basename(SOURCE_ARTICLES_PATH).split('.')[0].split('_')[-1]
        # Load source articles
        df_sources = pd.read_parquet(SOURCE_ARTICLES_PATH)
        id_map = {}
        for _, row in df_sources.iterrows():
            title = row['source_title'].lower()
            revid = str(row['first_version'])
            src_id = self.extract_article(lang, title, revid)
            id_map[(title, revid)] = src_id
        # Load scoring data
        df_scores = pd.read_parquet(SCORED_DATA_PATH)
        # Process each unique source-target pair
        for _, row in df_scores[
            ['source_title', 'first_version', 'target_title', 'target_lead']].drop_duplicates().iterrows():
            src_title = row['source_title'].lower()
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

    # This main() gives an example pipeline run:
    # pipeline.full_pipeline_example()

    # Uncomment the line below to run the full pipeline with parquet files
    pipeline.full_pipeline()


if __name__ == "__main__":
    main()
