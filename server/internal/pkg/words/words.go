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

// BuildHintMaskedWord rebuilds the masked word string with some positions revealed.
// revealed is a bool slice indexed per rune of the word.
// A revealed letter is shown as its lowercase character; hidden letters remain "_".
// Spaces in the original word are always preserved as " ".
func BuildHintMaskedWord(word string, revealed []bool) string {
	runes := []rune(word)
	result := ""
	for i, ch := range runes {
		if ch == ' ' {
			result += " "
		} else if i < len(revealed) && revealed[i] {
			result += string(ch) + ","
		} else {
			result += "_,"
		}
	}
	return result
}

func GetThreeRandomWords() []string {
	n := len(easyDrawWords)
	if n < 3 {
		return easyDrawWords
	}
	selected := make([]string, 0, 3)
	indices := make(map[int]bool)
	for len(selected) < 3 {
		idx := rng.Intn(n)
		if !indices[idx] {
			indices[idx] = true
			selected = append(selected, easyDrawWords[idx])
		}
	}
	return selected
}
