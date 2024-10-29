#include <Ticker.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <DacESP32.h>

//Setup
BLEServer* pServer = NULL;
BLECharacteristic* pSensorCharacteristic = NULL;
BLECharacteristic* pLedCharacteristic = NULL;
BLECharacteristic* pNotesCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
uint32_t value = 0;

// Create DAC object
DacESP32 dac1(GPIO_NUM_25);
Ticker tickNotes;
Ticker tick;

// Use the appropriate GPIO pin for your setup
const int buzzPin = 32; // Dac pin
const int ledGreenPin = 5; // Led pin

int current_note = 0;

#define SERVICE_UUID        "19b10000-e8f2-537e-4f6c-d104768a1214"
#define LED_CHARACTERISTIC_UUID "19b10002-e8f2-537e-4f6c-d104768a1214"
#define NOTES_CHARACTERISTIC_UUID "39114440-f153-414b-9ca8-cd739acad81c"

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
  };

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
  }
};

void functionDac(int firstValue){
  dac1.enable();
  dac1.outputCW(firstValue);
tickNotes.once(3, [](){
    dac1.disable();
  });
}

void buzzBeat() {
  digitalWrite(buzzPin, HIGH);
  tick.once(0.1, [](){
    digitalWrite(buzzPin,LOW);
  });
}

class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pNotesCharacteristic) {
    std::string value = pNotesCharacteristic->getValue();

    current_note = static_cast<uint8_t>(value[0]) | (static_cast<uint8_t>(value[1]) << 8);
    
    // Check print
    // Serial.println(firstValue);
    // Serial.println(secondValue);
  }
};

class MyCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pLedCharacteristic) {
    std::string value = pLedCharacteristic->getValue();
    int value_number = static_cast<int>(value[0]);
    if(value_number == 1) {
      // Serial.println("Green");
      buzzBeat();
    }else{
      functionDac(0);
      // Serial.println("Red");
    }
  } 
};

void setup() {
  Serial.begin(115200);
  pinMode(buzzPin, OUTPUT);
  pinMode(ledGreenPin, OUTPUT);
  dac1.enable();

// Create the BLE Device
  BLEDevice::init("ESP32");

// Create the BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

// Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

// Create the ON button Characteristic
  pLedCharacteristic = pService->createCharacteristic(
                      LED_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_WRITE_NR  
                    );

// Create the Notes Characteristic
  pNotesCharacteristic = pService->createCharacteristic(
                      NOTES_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_WRITE_NR  
                    );

// Register the callback for the ON button characteristic
  pLedCharacteristic->setCallbacks(new MyCharacteristicCallbacks());
// Register the callback for the NOTES characteristic
  pNotesCharacteristic->setCallbacks(new CharacteristicCallbacks());


// Start the service
  pService->start();

// Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
  BLEDevice::startAdvertising();
  Serial.println("Waiting a client connection to notify...");
}

void loop() {
  
  if (!deviceConnected && oldDeviceConnected) {
    Serial.println("Device disconnected.");
    digitalWrite(ledGreenPin, LOW);
    delay(500); // give the bluetooth stack the chance to get things ready
    pServer->startAdvertising(); // restart advertising
    Serial.println("Start advertising");
    oldDeviceConnected = deviceConnected;
  }
  // connecting
  if (deviceConnected && !oldDeviceConnected) {
    // do stuff here on connecting
    oldDeviceConnected = deviceConnected;
    digitalWrite(ledGreenPin, HIGH);
    Serial.println("Device Connected");
  }

  dac1.outputCW(current_note);

}