#include "application.h"
#include "pitches.h"

const int pulsePin = D6;

int ringButtonPin = D4;
int ringSpeakerPin = A1;

unsigned long lastPulse = 0;
int previous = LOW;
boolean ones = false;
unsigned long pulseLength = 80;
unsigned long countStart = 0;

int notes[] = {NOTE_E6, NOTE_G6, NOTE_E7, NOTE_C7, NOTE_D7, NOTE_G7};
int noteCount = 6;
unsigned long lastRing = 0;

void pollPulse() {
  int current = digitalRead(pulsePin);
  unsigned long now = millis();

  if (current != previous) {
    countStart = now;
  }
  previous = current;

  unsigned long count = now - countStart;

  if (count >= pulseLength && previous == HIGH) {
    ones = true;
  } 
  else if (count >= pulseLength && previous == LOW && ones) {
    long delta = 0;
    if (lastPulse > 0) { 
      delta = now - lastPulse; 
    }
    Serial.println(delta);
    lastPulse = now;
    ones = false;
  }
  
  digitalWrite(D7, now - lastPulse < 200 ? LOW : HIGH);
}

int doRing(String command) {
  Serial.println("ring");
  lastRing = millis();
  for (int j = 0; j < 4; ++j) {
    for (int i = 0; i < noteCount; ++i) {
      tone(ringSpeakerPin, notes[i]+100*j, 200);
      delay(50);
    }
  }
  return 0;
}

void pollRing() {
  if (millis() - lastRing < 1000) return;
  
  unsigned long start = millis();
  while (millis() - start < 100) {
    if (digitalRead(ringButtonPin) > 0) {
      return;
    }
  }
  doRing("");
}

void setup() {
  pinMode(D7, OUTPUT);
  
  pinMode(pulsePin, INPUT_PULLDOWN);

  pinMode(ringButtonPin, INPUT_PULLUP);
  pinMode(ringSpeakerPin, OUTPUT);

  Spark.function("ring", doRing);
  
  Serial.begin(9600);
  Serial.println("start");
}

void loop() {
  pollPulse();
  pollRing();
}
