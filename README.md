# Task 2 Weather App

**It verifies setup flow then going into setting and Changing some   
    settings and then returning home page Validating Settings  
    is applied and Correct Data is Displayed**  

- **Used Page Object Model for Scalability and Readability**
- **Used Fluent POM and Descriptive Steps to make normal user understand it**
- **Pop up Messages Challenged me as it does appear semiRandom**
- **But I did Capture it's Locator and Handle it Using Wait**
- **Used DriverFactory to Ensure only Single Insatnce of it**

## Prerequisite
1. Having emulator / Real Device for Testing 
2. Installing Weather APP on Device / Emulator  https://play.google.com/store/apps/details?id=com.info.weather.forecast
3. Appium is installed and running locally on ipAddress=127.0.0.1 || port=4723

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/Khaled-MohyEldin/AppStore-Test-Automation.git
   
2. Install dependencies:
    ```bash
   mvn clean install

5. Run test:
   ```bash
   mvn test
   
7. See Reults in Allure Reports
   ```bash
   allure serve allure-results

## Tech Stack
- **Java 21**
- **Appium 3.x**
- **TestNG**
- **Maven**
- **Android Emulator / Real Device**
