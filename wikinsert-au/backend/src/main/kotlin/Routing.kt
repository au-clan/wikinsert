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

    val dbService by inject<DbService>()
    routing {
        post("/heatmap") {
            val srcRevisionId = call.parameters["src_rev_id"] ?: error("rev_id not found")
            val srcTitle = call.parameters["src_title"] ?: error("title not found")
            val targetRevisionId = call.parameters["target_rev_id"] ?: error("rev_id not found")
            val targetTitle = call.parameters["target_title"] ?: error("title not found")

            val lang  = call.parameters["lang"] ?: ""

            val srcSentenceData = dbService.getSourceTargetPairs(srcRevisionId, targetRevisionId, srcTitle, targetTitle, lang)
            val jsonEncode = Json.encodeToString(srcSentenceData)
            println(jsonEncode)
            call.respondText(jsonEncode)

        }
        get("/heatmap"){
            call.respondText("Hello, world!")
        }
    }
}


