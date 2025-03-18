package com.example

import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.junit.After
import org.junit.Before
import org.koin.core.context.startKoin
import org.koin.core.context.stopKoin
import org.koin.dsl.module
import kotlin.test.Test
import kotlin.test.assertEquals

class ApplicationTest {
    @Before
    fun setUp() {
        val koinSetup = module {
            single<DbService> { DbServiceMock() }
        }
        startKoin {
            listOf(koinSetup)
        }
    }
    @Test
    fun testRoot() = testApplication {
        application {
            configureRouting()
        }
        client.post("/heatmap") {
            parameter("src_rev_id", "1")
            parameter("src_title", "title")
            parameter("target_rev_id", "2")
            parameter("target_title", "title")
            parameter("lang", "en")
        }.apply {
            assertEquals(HttpStatusCode.OK, status)
        }
    }

    @After
    fun teardown() {
        stopKoin()
    }

}
