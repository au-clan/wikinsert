// build.gradle.kts (or gradle.build)
// Make sure you have the dependency:
// implementation("io.ktor:ktor-server-cors:<ktor_version>")

package com.example

import com.mongodb.kotlin.client.coroutine.MongoClient
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.cors.routing.*
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger


fun main(args: Array<String>) {
    embeddedServer(Netty, port = 8080) {
        module()
    }.start(wait = true)
}

fun Application.module() {
    configureCors()
    configureRouting()
    install(Koin) {
        slf4jLogger()
        modules(listOf(koinModule))

    }
}

val koinModule = module {
    // MongoDB client and database
    single { MongoClient.create("mongodb://localhost:27017/") }
    single { get<MongoClient>().getDatabase("wikinsert") }

    // Repositories
    single<ArticleRepository> { MongoArticleRepository(get()) }
    single<ArticleContentRepository> { MongoArticleContentRepository(get()) }
    single<ArticleScoreRepository> { MongoArticleScoreRepository(get()) }

    // DbService - use MongoDbService for production, DbServiceMock for testing
    single<DbService> { MongoDbService(get(), get(), get()) }
    // Uncomment the line below and comment the line above to use the mock implementation
    // single<DbService> { DbServiceMock() }
}


fun Application.configureCors() {
    install(CORS) {
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowHeader(HttpHeaders.ContentType)
        anyHost()
    }
}
