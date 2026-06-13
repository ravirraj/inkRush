package app

import (
	"fmt"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/ravirraj/inkRush/server/internal/transport/websoc/handler"
)

type App struct {
	port   string
	router *gin.Engine
}

func NewApp() *App {
	port := os.Getenv("PORT")

	if port == "" {
		port = "8080"
	}

	WsHandler := handler.NewWebSocketHandler()

	router := NewRouter(WsHandler)
	return &App{
		port:   ":" + port,
		router: router,
	}
}

func (a *App) Run() error {
	fmt.Printf("Starting Server on port %s\n", a.port)
	return a.router.Run(a.port)
}
