package main

import (
	"fmt"

	"github.com/ravirraj/inkRush/server/internal/app"
)

func main () {
	app := app.NewApp()
	err := app.Run()
	if err != nil {
		fmt.Println(err)
		return
	}
}
