package app

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/ravirraj/inkRush/server/internal/transport/websoc/handler"
)

type App struct {
	port   string
	router *gin.Engine
}

func NewApp() *App {
	port := ":8080"

	WsHandler := handler.NewWebSocketHandler()

	router := NewRouter(WsHandler)
	return &App{
		port:   port,
		router: router,
	}
}

func (a *App) Run() error {
	fmt.Println("Starting Server on port :8080")
	return a.router.Run(a.port)
}
