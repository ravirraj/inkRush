package app

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ravirraj/inkRush/server/internal/transport/websoc/handler"
)

func NewRouter(wsHandler *handler.WebSocketHandler) *gin.Engine {
	router := gin.Default()
	router.GET("/ws", wsHandler.Handle)
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.
			H{
			"status": "Health Ok",
		})
	})
	return router
}
