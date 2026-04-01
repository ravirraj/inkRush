package words

import (
	"math/rand"
	"time"
)

var easyDrawWords = []string{
	"Sun", "Moon", "Star", "Cloud", "Tree", "Flower", "Leaf", "Apple", "Banana", "Fish",
	"Bird", "Cat", "Dog", "House", "Car", "Bus", "Boat", "Airplane", "Ball", "Kite",
	"Cup", "Book", "Chair", "Table", "Clock", "Shoe", "Hat", "Umbrella", "Ice cream", "Cake",
	"Pizza", "Heart", "Smiley face", "Balloon", "Candle", "Key", "Lock", "Pencil", "Pen", "Backpack",
	"Phone", "Glasses", "Camera", "Guitar", "Crown", "Robot", "Snowman", "Butterfly", "Rainbow", "Mountain",
}

var rng = rand.New(rand.NewSource(time.Now().UnixNano()))

func GetRandomWord() string {
	return easyDrawWords[rng.Intn(len(easyDrawWords))]
}

func GetMaskedWord(word string) string {
	masked := ""
	for _, ch := range word {
		if ch == ' ' {
			masked += " "
		} else {
			masked += "_,"
		}
	}
	return masked
}
