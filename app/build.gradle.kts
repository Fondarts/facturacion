plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.kapt")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.facturacion.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.facturacion.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = "17"
    }
    
    buildFeatures {
        compose = true
    }
    
    // Fix para KAPT con Java 17+
    kapt {
        correctErrorTypes = true
        useBuildCache = true
        javacOptions {
            option("--add-exports", "jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED")
            option("--add-exports", "jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED")
            option("--add-exports", "jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED")
            option("--add-exports", "jdk.compiler/com.sun.tools.javac.processing=ALL-UNNAMED")
            option("--add-exports", "jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED")
            option("--add-exports", "jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED")
            option("--add-exports", "jdk.compiler/com.sun.tools.javac.main=ALL-UNNAMED")
        }
    }
    
    
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
    
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Core Android
    implementation("androidx.core:core-ktx:1.13.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.activity:activity-compose:1.8.2")
    
    // Compose
    implementation(platform("androidx.compose:compose-bom:2023.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3:1.1.2")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.5")
    
    // Room Database
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    
    // ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.6.2")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")
    
    // ML Kit OCR (Text Recognition)
    implementation("com.google.mlkit:text-recognition:16.0.0")
    
    // ExifInterface for image rotation
    implementation("androidx.exifinterface:exifinterface:1.3.7")
    
    // Image Loading
    implementation("io.coil-kt:coil-compose:2.5.0")
    
    // PDF Handling
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    
    // Excel Export
    implementation("org.apache.poi:poi-ooxml:5.2.4")
    implementation("org.apache.poi:poi:5.2.4")
    
    // Date Picker
    implementation("io.github.vanpra.compose-material-dialogs:datetime:0.9.0")
    
    // Permissions
    implementation("com.google.accompanist:accompanist-permissions:0.32.0")
    
    // Retrofit for API calls (sync with web)
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    
    // DataStore for preferences (server URL)
    implementation("androidx.datastore:datastore-preferences:1.0.0")
    
    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-firestore-ktx")
    
    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2023.10.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

// Configurar para evitar error de jlink pero permitir compilación de código generado por KAPT
configurations.all {
    resolutionStrategy {
        // Evitar transformación problemática de jlink
        eachDependency {
            if (requested.name.contains("core-for-system-modules")) {
                // No hacer nada, dejar que se use directamente
            }
        }
    }
}

// Configurar tareas de compilación Java para manejar error de jlink
tasks.withType<JavaCompile>().configureEach {
    options.isFork = true
    // Intentar continuar incluso si hay problemas con jlink
    options.compilerArgs.add("-Xmaxerrs")
    options.compilerArgs.add("1000")
}

