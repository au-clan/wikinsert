package com.example

import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.firstOrNull

/**
 * Repository interface for article_contents collection
 */
interface ArticleContentRepository {
    /**
     * Get article content by article ID
     */
    suspend fun getContentById(articleId: String): ArticleContent?
}

/**
 * MongoDB implementation of ArticleContentRepository
 */
class MongoArticleContentRepository(database: MongoDatabase) : ArticleContentRepository {
    private val collection = database.getCollection<ArticleContent>("article_contents")

    override suspend fun getContentById(articleId: String): ArticleContent? {
        return collection.find(Filters.eq("_id", articleId)).firstOrNull()
    }
}