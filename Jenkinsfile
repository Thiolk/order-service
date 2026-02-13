pipeline {
  agent any

  environment {
    DOCKERHUB_USER = "thiolengkiat413"
    IMAGE_NAME     = "order-service"

    // Standard repo paths
    DOCKERFILE_PATH = "deploy/docker/Dockerfile"
    ENV_FILE        = "deploy/docker/.env"  // Jenkins should provision this (or use .env.example for CI)
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
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

    stage('Test (Integration - scaffolding)') {
      steps {
        sh '''
          set -eux
          # For now: run integration tests without needing full DB logic.
          # When you add real tests, we will bring up docker-compose.test.yml first.
          npm run test:integration
        '''
      }
    }

    stage('Static Analysis (SonarQube)') {
      steps {
        sh '''
          set -eux
          # If you want coverage, switch test to: npm test -- --coverage
          # and ensure coverage/lcov.info exists.
          echo "Running SonarQube analysis..."
        '''
        // Typical SonarQube Jenkins pattern (requires Jenkins SonarQube plugin configured):
        // withSonarQubeEnv('SonarQubeServerName') {
        //   sh 'sonar-scanner'
        // }
        // timeout(time: 5, unit: 'MINUTES') {
        //   waitForQualityGate abortPipeline: false
        // }
      }
    }

    stage('Resolve Image Tags') {
      steps {
        script {
          // Short SHA
          def shortSha = sh(script: "git rev-parse --short=7 HEAD", returnStdout: true).trim()

          // Multibranch pipelines often provide TAG_NAME if building a tag
          def tagName = env.TAG_NAME?.trim()

          // Fallback: try to detect exact tag on this commit
          if (!tagName) {
            tagName = sh(script: "git describe --tags --exact-match 2>/dev/null || true", returnStdout: true).trim()
            if (tagName == "") { tagName = null }
          }

          // Remove leading 'v' if someone accidentally tags with v1.1.0 (you said you don't want v)
          if (tagName && tagName.startsWith("v")) {
            tagName = tagName.substring(1)
          }

          env.GIT_SHA_SHORT = shortSha
          env.VERSION_TAG   = tagName ?: ""   // empty means "no version tag for this build"
          env.BUILD_TAG     = env.BUILD_NUMBER
          env.COMMIT_TAG    = "git-${shortSha}"

          // Latest policy:
          // - push latest only on main OR on version tag builds
          def branch = env.BRANCH_NAME ?: ""
          env.PUSH_LATEST = (branch == "main" || env.VERSION_TAG != "") ? "true" : "false"

          echo "Resolved tags:"
          echo "  VERSION_TAG = ${env.VERSION_TAG}"
          echo "  BUILD_TAG   = ${env.BUILD_TAG}"
          echo "  COMMIT_TAG  = ${env.COMMIT_TAG}"
          echo "  PUSH_LATEST = ${env.PUSH_LATEST}"
        }
      }
    }

    stage('Container Build') {
      steps {
        sh '''
          set -eux
          docker build -f "${DOCKERFILE_PATH}" -t "${DOCKERHUB_USER}/${IMAGE_NAME}:${COMMIT_TAG}" .
        '''
      }
    }

    stage('Security Scan (Docker Scout - notify only, mandatory)') {
      steps {
        sh '''
          set -eux
          # Scan the image we just built (commit tag)
          IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}:${COMMIT_TAG}" ./scripts/security-docker-scout-scan.sh
        '''
      }
    }

    stage('Container Tag') {
      steps {
        sh '''
          set -eux
          SRC="${DOCKERHUB_USER}/${IMAGE_NAME}:${COMMIT_TAG}"

          # Always tag build number
          docker tag "${SRC}" "${DOCKERHUB_USER}/${IMAGE_NAME}:${BUILD_TAG}"

          # Tag version if present (build is running on a git tag like 1.1.0)
          if [ -n "${VERSION_TAG}" ]; then
            docker tag "${SRC}" "${DOCKERHUB_USER}/${IMAGE_NAME}:${VERSION_TAG}"
          fi

          # Tag latest only on main or tag builds
          if [ "${PUSH_LATEST}" = "true" ]; then
            docker tag "${SRC}" "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
          fi
        '''
      }
    }

    stage('Container Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            set -eux
            echo "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin

            # Always push commit + build tags
            docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:${COMMIT_TAG}"
            docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:${BUILD_TAG}"

            # Push version tag if present
            if [ -n "${VERSION_TAG}" ]; then
              docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:${VERSION_TAG}"
            fi

            # Push latest only when allowed
            if [ "${PUSH_LATEST}" = "true" ]; then
              docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
            fi
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          set -eux
          echo "Deploy stage placeholder: will be implemented in Kubernetes phase."
          echo "Image to deploy (preferred): ${DOCKERHUB_USER}/${IMAGE_NAME}:${VERSION_TAG:-${COMMIT_TAG}}"
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