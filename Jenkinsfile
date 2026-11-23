
pipeline {
    agent any

    environment {
        DOCKERHUB_USER = 'shintadevi'
        IMAGE_NAME = 'laparin'
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            steps {
                sh '''
                    docker build \
                        --target test \
                        -t laparin-test:${BUILD_NUMBER} .
                '''
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                    docker build \
                        --target runtime \
                        -t ${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG} \
                        -t ${DOCKERHUB_USER}/${IMAGE_NAME}:latest .
                '''
            }
        }

        stage('Push Image to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_TOKEN'
                    )
                ]) {
                    sh '''
                        echo "$DOCKER_TOKEN" | docker login \
                            -u "$DOCKER_USER" --password-stdin

                        docker push ${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${DOCKER_USER}/${IMAGE_NAME}:latest

                        docker logout
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'laparin-env',
                        variable: 'ENV_FILE'
                    ),
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_TOKEN'
                    )
                ]) {
                    sh '''
                        cp "$ENV_FILE" .env

                        export DOCKERHUB_USER="$DOCKER_USER"
                        export IMAGE_TAG="${BUILD_NUMBER}"

                        echo "$DOCKER_TOKEN" | docker login \
                            -u "$DOCKER_USER" --password-stdin

                        docker compose pull app
                        docker compose up -d --no-build

                        docker logout
                    '''
                }
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                    for attempt in $(seq 1 12); do
                        if curl --fail --silent \
                            http://host.docker.internal:8000/health; then
                            echo "Smoke test berhasil"
                            exit 0
                        fi

                        echo "Menunggu aplikasi siap..."
                        sleep 5
                    done

                    echo "Smoke test gagal"
                    exit 1
                '''
            }
        }
    }

    post {
        always {
            sh 'rm -f .env'
        }
    }
}
