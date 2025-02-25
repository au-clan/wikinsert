package com.example

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.koin.ktor.ext.inject


fun Application.configureRouting() {
    val dbService: DbService by inject<DbServiceMock>()

    routing {
        post("/heatmap/") {
            val body = call.receiveText()
            val bodyJson = Json.parseToJsonElement(body)
            val sentenceHashes = bodyJson.jsonObject["sentenceHashes"]?.jsonArray?.map{it.toString()} ?: emptyList()
            val sentenceScorePairs = dbService.getScoresForSentenceHashes(sentenceHashes)
            call.respondText(Json.encodeToString(sentenceScorePairs))
        }
    }
}


