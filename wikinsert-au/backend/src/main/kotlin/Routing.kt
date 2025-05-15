package com.example

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.koin.ktor.ext.inject


fun Application.configureRouting() {

    val dbService by inject<DbService>()
    routing {
        post("/heatmap") {
            val srcRevisionId = call.parameters["src_rev_id"] ?: error("rev_id not found")
            val srcTitle = call.parameters["src_title"] ?: error("title not found")
            val targetTitle = call.parameters["target_title"] ?: error("title not found")

            val lang = call.parameters["lang"] ?: error("lang not found")

            val srcSentenceData = dbService.getScores(srcRevisionId, srcTitle, targetTitle, lang)
            val jsonEncode = Json.encodeToString(srcSentenceData)
            println("Heatmap: $jsonEncode")
            call.respondText(jsonEncode)

        }

        get("/searchTargets") {
            val query = call.request.queryParameters["q"] ?: ""
            val sourceTitle = call.request.queryParameters["source_title"] ?: return@get call.respond(
                HttpStatusCode.BadRequest,
                "Missing or malformed source_title"
            )
            if (sourceTitle.isEmpty() || sourceTitle.isBlank()) {
                return@get call.respond(
                    HttpStatusCode.BadRequest,
                    "Missing or malformed source_title"
                )
            }
            val lang = call.request.queryParameters["lang"] ?: "en"
            println("Query: $query")
            val finalArticles = dbService.getTargetsForSourceArticleBySearchQuery(sourceTitle, lang, query)
            println("Final articles: $finalArticles")
            val jsonEncode = Json.encodeToString(finalArticles)
            call.respond(jsonEncode)
        }

        get("/search") {
            val query = call.request.queryParameters["q"] ?: ""

            val lang = call.request.queryParameters["lang"] ?: "en"
            println("Query: $query")

            val finalArticles = dbService.getArticlesBySearchQuery(query, lang)
            println("Final articles: $finalArticles")
            val jsonEncode = Json.encodeToString(finalArticles)
            call.respond(jsonEncode)
        }

        get("/heatmap"){
            call.respondText("Hello, world!")
        }
    }
}


