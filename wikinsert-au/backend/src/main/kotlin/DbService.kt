package com.example

import kotlinx.serialization.Serializable

interface DbService {
    fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData>
}

class DbServiceMock : DbService {


    override fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData> {
        return listOf(
            SentenceData( 1,0, 10, 0.85),
            SentenceData( 2,11, 20, 0.92),
            SentenceData( 3,21, 30, 0.78)
        )
    }
}


@Serializable
data class SentenceData(
    val id : Int,
    val startOffset: Int,
    val endOffset: Int,
    val score: Double,
)



