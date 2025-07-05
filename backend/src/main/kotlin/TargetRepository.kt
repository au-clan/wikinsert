package com.example

import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.toList
import org.bson.conversions.Bson

interface TargetRepository {
    suspend fun applyBsonFilter(filter: Bson): List<Target>
}


class MongoTargetRepository(database: MongoDatabase) : TargetRepository {
    private val collection = database.getCollection<Target>("targets")

    override suspend fun applyBsonFilter(filter: Bson): List<Target> {
        return collection.find(filter).toList()
    }
}
