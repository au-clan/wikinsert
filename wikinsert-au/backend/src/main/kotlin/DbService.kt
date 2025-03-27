package com.example

import kotlinx.serialization.Serializable

interface DbService {
    fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData>
}

class DbServiceMock : DbService {


    override fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData> {
        return listOf(
            SentenceData( 1, 0,304, 0.5),
           SentenceData( 2,304,428, 0.6),
            SentenceData( 3,428, 488, 0.7),
            SentenceData( 4, 488, 569, 0.82),
            SentenceData( 5,569,863, 0.95),
            SentenceData( 5,863,910, 0.95),
            SentenceData( 5,910,1030, 0.95),


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



