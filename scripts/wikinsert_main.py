import hashlib
import logging

import _md5

from sentence_score import get_sentence_scores
from wiki_mongo_db import WikiMongoDB
from wiki_sentence_utils import extract_lead_section, parse_article


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

    def score_and_store(self, source_article_id, target_article_id):
        """
        1) Check if there's an existing 'scores' document for (source_article_id, target_article_id).
           If so, skip unless 'force' is True.
        2) If needed, fetch sections of the source article, parse or load the target article to get
           relevant info (like lead section, if desired).
        3) Run scoring, store results in 'scores'.
        """
        # Check if scores already exist
        pair_id = hashlib.md5(f"{source_article_id}{target_article_id}".encode()).hexdigest()
        existing = self.db.get_scores(pair_id)
        if existing:
            logging.info(f"Scores for pair_id={pair_id} exist. Skipping unless force=True.")
            return

        # Retrieve source sections:
        source_title = self.db.get_article_meta_data(source_article_id)["title"]

        source_sections = self.db.get_sections(source_article_id)
        target_sections = self.db.get_sections(target_article_id)

        target_title = self.db.get_article_meta_data(target_article_id)["title"]
        target_lead = extract_lead_section(target_sections)

        scores = get_sentence_scores(
            source_sections,
            source_title,
            target_title,
            target_lead,
            model_dir="",
        )
        # Save to DB
        self.db.add_scores(source_article_id, target_article_id, scores.to_dict('records'))
        self.db.update_article_targets(source_article_id, target_article_id)

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
            self.score_and_store(source_id, target_id)


def main():
    logging.basicConfig(level=logging.INFO)
    pipeline = WikiPipeline()

    # This main() gives an example pipeline run:
    pipeline.full_pipeline_example()


if __name__ == "__main__":
    main()
