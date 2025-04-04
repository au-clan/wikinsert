package com.example

import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.conversions.Bson

/**
 * Repository interfaces and implementations for MongoDB collections
 */

/**
 * Repository interface for articles collection
 */
interface ArticleRepository {
    /**
     * Get an article by ID
     */
    suspend fun getArticleById(id: String): Article?

    /**
     * List all articles
     */
    suspend fun getAll(): List<Article>

    suspend fun getByTitle(title: String): Article?

    suspend fun applyBsonFilter(filter: Bson): List<Article>
}

/**
 * MongoDB implementation of ArticleRepository
 */
class MongoArticleRepository(database: MongoDatabase) : ArticleRepository {
    private val collection = database.getCollection<Article>("articles")

    override suspend fun getArticleById(id: String): Article? {
        return collection.find(Filters.eq("_id", id)).firstOrNull()
    }

    override suspend fun getAll(): List<Article> {
        return collection.find().toList()
    }

    override suspend fun getByTitle(title: String): Article? {
        return collection.find(Filters.regex("title", "^$title$", "i")).firstOrNull()
    }

    override suspend fun applyBsonFilter(filter: Bson): List<Article> {
        return collection.find(filter).toList()
    }
}

