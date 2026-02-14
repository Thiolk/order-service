pipeline {
  agent any

  environment {
    PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

    DOCKERHUB_USER   = "thiolengkiat413"
    IMAGE_NAME       = "order-service"
    DOCKERFILE_PATH  = "deploy/docker/Dockerfile"

    IMAGE_TAG   = ""
    RELEASE_TAG = ""

    TARGET_ENV = "none"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Determine Pipeline Mode') {
      steps {
        script {
          def isPR   = env.CHANGE_ID?.trim()
          def branch = env.BRANCH_NAME ?: ""
          def tagName = env.TAG_NAME?.trim()
          env.RELEASE_TAG = tagName ?: ""

          if (isPR) {
            env.TARGET_ENV = "build"
          } else if (tagName) {
            env.TARGET_ENV = "prod"        // manual trigger is pushing a git tag
          } else if (branch == "develop") {
            env.TARGET_ENV = "dev"
          } else if (branch.startsWith("release/")) {
            env.TARGET_ENV = "staging"
          } else {
            env.TARGET_ENV = "build"
          }

          echo "BRANCH_NAME: ${branch}"
          echo "TAG_NAME: ${tagName ?: 'none'}"
          echo "CHANGE_ID: ${env.CHANGE_ID ?: 'none'}"
          echo "TARGET_ENV: ${env.TARGET_ENV}"
        }
      }
    }

    stage('Build (Lint/Format)') {
      steps {
        sh '''
          set -eux
          npm ci
          npm run lint
          npm run format:check
        '''
      }
    }

    stage('Test (Unit)') {
      steps {
        sh '''
          set -eux
          npm run test:unit
        '''
      }
    }

    stage('Test (Integration)') {
      steps {
        sh '''
          set -eux
          npm run test:integration
        '''
      }
    }

    stage('Static Analysis (SonarQube)') {
      environment {
        SONAR_PROJECT_KEY = 'order-service'
        SONAR_HOST_URL = 'http://host.docker.internal:9005'
      }
      steps {
        withCredentials([string(credentialsId: 'order-service-sonar', variable: 'SONAR_TOKEN')]) {
          sh '''
            set -eux

            docker run --rm \
              -v "$PWD:/usr/src" \
              -w /usr/src \
              sonarsource/sonar-scanner-cli:latest \
              -Dsonar.projectKey="$SONAR_PROJECT_KEY" \
              -Dsonar.sources=src \
              -Dsonar.tests=tests \
              -Dsonar.host.url="$SONAR_HOST_URL" \
              -Dsonar.token="$SONAR_TOKEN"
          '''
        }

        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }


    stage('Resolve Image Tags') {
      when { expression { return env.TARGET_ENV != "build" } }
      steps {
        script {
          env.IMAGE_TAG = env.BUILD_NUMBER
          echo "Resolved image tag strategy:"
          echo "IMAGE_TAG (BUILD_NUMBER) = ${env.IMAGE_TAG}"
          echo "RELEASE_TAG (git tag)    = ${env.RELEASE_TAG ?: 'none'}"
        }
      }
    }

    stage('Container Build') {
      when { expression { return env.TARGET_ENV != "build" } }
      steps {
        sh '''
          set -eux
          docker build -f "${DOCKERFILE_PATH}" -t "${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}" .
        '''
      }
    }

    stage('Security Scan (Docker Scout - notify only, mandatory)') {
      when { expression { return env.TARGET_ENV != "build" } }
      steps {
        sh '''
          set -eux
          IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}" ./scripts/security-docker-scout-scan.sh
        '''
      }
    }

    stage('Tag Latest (Prod only)') {
      when { expression { return env.TARGET_ENV == "prod" } }
      steps {
        sh '''
          set -eux
          docker tag "${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
        '''
      }
    }

    stage('Container Push') {
      when { expression { return env.TARGET_ENV != "build" } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            set -eux
            echo "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin
            docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"

            if [ "${TARGET_ENV}" = "prod" ]; then
              docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
            fi
          '''
        }
      }
    }

    stage('Deploy (Dev)') {
      when { expression { return env.TARGET_ENV == "dev" } }
      steps {
        sh '''
          set -eux
          echo "Deploy stage placeholder: will be implemented in Kubernetes phase."
          echo "Deploying to DEV from develop branch"
          echo "Image: ${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
        '''
      }
    }

    stage('Deploy (Staging)') {
      when { expression { return env.TARGET_ENV == "staging" } }
      steps {
        sh '''
          set -eux
          echo "Deploy stage placeholder: will be implemented in Kubernetes phase."
          echo "Deploying to STAGING from release branch"
          echo "Image: ${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
        '''
      }
    }

    stage('Prod Eligibility Check (tag must be on main)') {
      when { expression { return env.TARGET_ENV == "prod" } }
      steps {
        sh '''
          set -eux
          git fetch origin main --tags
          if git merge-base --is-ancestor HEAD origin/main; then
            echo "OK: Tagged commit is on main."
          else
            echo "BLOCK: Tagged commit is NOT on main. Merge release into main first."
            exit 1
          fi
        '''
      }
    }

    stage('Prod Approval') {
      when { expression { return env.TARGET_ENV == "prod" } }
      steps {
        script {
          timeout(time: 30, unit: 'MINUTES') {
            input message: "Approve PROD deploy for ${env.IMAGE_NAME} on main? (Tag: ${env.RELEASE_TAG})", ok: "Deploy"
          }
        }
      }
    }

    stage('Deploy (Prod)') {
      when { expression { return env.TARGET_ENV == "prod" } }
      steps {
        sh '''
          set -eux
          echo "Deploy stage placeholder: will be implemented in Kubernetes phase."
          echo "Deploying to PROD from main branch (manual trigger via git tag)"
          echo "Release tag trigger: ${RELEASE_TAG}"
          echo "Image: ${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
          echo "Also pushed: ${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
        '''
      }
    }
  }

  post {
    always {
      sh '''
        set +e
        docker logout || true
      '''
    }
  }
}