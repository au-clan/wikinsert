// build.gradle.kts (or gradle.build)
// Make sure you have the dependency:
// implementation("io.ktor:ktor-server-cors:<ktor_version>")

package com.example

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.cors.routing.*
import org.jetbrains.exposed.sql.Database
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.bind
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger


fun main(args: Array<String>) {
    embeddedServer(Netty, port = 8080) {
        module()
    }.start(wait = true)
}

fun Application.module() {
    configureRouting()
    configureCors()
    install(Koin) {
        slf4jLogger()
        modules(listOf(koinModule))

    }
}

val koinModule = module {
    single<DbService> { DbServiceMock() }
}


fun Application.configureCors() {
    install(CORS) {
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        anyHost()
    }
}

