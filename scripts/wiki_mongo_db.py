import logging
from typing import Dict, Any, List, Optional

import _md5
from pymongo import MongoClient

# Import utility functions from the common module

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class WikiMongoDB:
    """
    Class to handle MongoDB operations for Wikipedia article extraction and scoring.
    """

    def __init__(self, mongo_uri: str = None, db_name: str = None):
        import os
        mongo_uri = mongo_uri or os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
        db_name = db_name or os.environ.get("DB_NAME", "wikinsert")

        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.articles_collection = self.db["articles"]
        self.contents_collection = self.db["article_contents"]
        self.scores_collection = self.db["article_scores"]
        self.targets_collection = self.db["targets"]

    def add_article_meta_data(self, lang: str, title: str, revid: str, thumbnail: Dict[str, any],
                              description: str) -> str:
        # id is hashed from title and revid with lang
        article_id = _md5.md5(f"{lang}{title}{revid}".encode()).hexdigest()
        self.articles_collection.insert_one({
            "_id": article_id,
            "lang": lang,
            "title": title,
            "revid": revid,
            "thumbnail": thumbnail,
            "description": description,
        })
        logging.info(f"Inserted article '{title}' with ID {article_id}")
        return str(article_id)

    def add_sections(self, article_id: str, sections: List[Dict[str, Any]]) -> str:
        contents = {
            "_id": article_id,
            "sections": sections
        }
        result = self.contents_collection.insert_one(contents)
        return str(result.inserted_id)

    def add_scores(self, source_id: str, target_id: str, scores: List[Dict[str, Any]]) -> str:
        article_meta = self.get_article_meta_data(source_id)
        lang = article_meta["lang"]
        hashed_id = _md5.md5(f"{lang}{target_id}{source_id}".encode()).hexdigest()
        contents = {
            "_id": hashed_id,
            "source_id": source_id,
            "target_id": target_id,
            "scores": scores
        }
        result = self.scores_collection.insert_one(contents)
        return str(result.inserted_id)

    def update_article_targets(self, article_id: str, target_id: str) -> None:
        result = self.articles_collection.update_one(
            {"_id": article_id},
            {"$addToSet": {"targets": target_id}}
        )
        if result.modified_count > 0:
            logging.info(f"Updated article {article_id} with target {target_id}")
        else:
            logging.info(f"No update needed for article {article_id} with target {target_id}")

    def get_sections(self, article_id: str = None) -> List[Dict[str, Any]]:
        section = self.contents_collection.find_one({"_id": article_id})
        return section.get("sections", [])

    def get_article_meta_data(self, article_id: str = None) -> Optional[Dict[str, Any]]:
        article = self.articles_collection.find_one({"_id": article_id})
        # article is Mapping so convert to dict
        return dict(article) if article else None

    def get_scores(self, pair_id: str) -> List[Dict[str, Any]]:
        scores = list(self.scores_collection.find({"_id": pair_id}))
        return scores

    def list_articles(self) -> List[Dict[str, Any]]:
        return list(self.articles_collection.find())

    def add_target_meta(self, target_title: str, lang: str, lead: str,
                        thumbnail: Dict[str, Any], description: str) -> str:
        """
        Store metadata for a target article for search and display.
        """
        # Use lang+title for a unique ID
        target_id = _md5.md5(f"{lang}{target_title}".encode()).hexdigest()
        contents = {
            "_id": target_id,
            "title": target_title,
            "lang": lang,
            "lead": lead,
            "thumbnail": thumbnail,
            "description": description,
        }
        # Upsert to avoid duplicates
        self.targets_collection.update_one(
            {"_id": target_id},
            {"$set": contents},
            upsert=True
        )
        return target_id
