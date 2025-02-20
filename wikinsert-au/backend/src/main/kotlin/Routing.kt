package com.example

import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*


fun Application.configureRouting() {
    routing {
        get("/heatmap") {
            // Just return a random score between 0.5 and 1.0
            val randomScore = Math.random().toString()
            call.respondText(randomScore)
        }
    }
}
