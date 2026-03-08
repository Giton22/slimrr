package main

import (
	"log"

	"bodyweight-tracker/pb"
)

func main() {
	if err := pb.Start(); err != nil {
		log.Fatal(err)
	}
}
