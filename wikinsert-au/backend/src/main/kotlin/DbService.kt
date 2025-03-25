package com.example

import kotlinx.serialization.Serializable

interface DbService {
    fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData>
}

class DbServiceMock : DbService {


    override fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData> {
        return listOf(
            SentenceData( 1, 0,323, 0.5),
           SentenceData( 2,323,446, 0.6),
            SentenceData( 3,446, 506, 0.7),
            SentenceData( 4, 506, 589, 0.82),
            SentenceData( 5,589,885, 0.95),


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



