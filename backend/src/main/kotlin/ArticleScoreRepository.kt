package com.example

import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.firstOrNull

/**
 * Repository interface for article_scores collection
 */
interface ArticleScoreRepository {
    /**
     * Get article scores by pair ID
     */
    suspend fun getScoresByPairId(pairId: String): ArticleScore?
}

/**
 * MongoDB implementation of ArticleScoreRepository
 */
class MongoArticleScoreRepository(database: MongoDatabase) : ArticleScoreRepository {
    private val collection = database.getCollection<ArticleScore>("article_scores")

    override suspend fun getScoresByPairId(pairId: String): ArticleScore? {
        return collection.find(Filters.eq("_id", pairId)).firstOrNull()
    }
}