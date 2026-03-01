pipeline {
  agent any

  parameters {
    choice(name: 'FORCE_ENV', choices: ['', 'build', 'rc', 'dev', 'staging', 'prod'],
          description: 'Override TARGET_ENV for testing. Leave blank for normal logic.')
    string(name: 'FORCE_RELEASE_TAG', defaultValue: '',
          description: 'If FORCE_ENV=prod, provide a tag like v1.2.3 (testing only).')
  }

  environment {
    PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

    DOCKERHUB_USER   = "thiolengkiat413"
    IMAGE_NAME       = "order-service"
    DOCKERFILE_PATH  = "deploy/docker/Dockerfile"

    K8S_DIR = "k8s/order-service/overlays"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Determine Pipeline Mode') {
      steps {
        script {
          env.IMAGE_TAG   = ""
          env.TARGET_ENV = "build"
          def branch  = env.BRANCH_NAME ?: ""
          def tagName = env.TAG_NAME?.trim()
          env.RELEASE_TAG = tagName ?: ""

          if (tagName) {
            env.TARGET_ENV = "prod"
          } else if (branch == "main") {
            env.TARGET_ENV = "staging"          // promotion/deploy-to-staging happens here
          } else if (branch == "develop") {
            env.TARGET_ENV = "dev"
          } else if (branch.startsWith("release/")) {
            env.TARGET_ENV = "rc"               // release candidate validation only
          } else {
            env.TARGET_ENV = "build"            // feature/* or other branches
          }

          // ----- MANUAL OVERRIDE FOR TESTING -----
          def forced = (params.FORCE_ENV ?: "").trim()
          if (forced) {
            env.TARGET_ENV = forced
            if (forced == "prod") {
              def forcedTag = (params.FORCE_RELEASE_TAG ?: "").trim()
              if (forcedTag) {
                env.RELEASE_TAG = forcedTag
              }
            }
            echo "FORCE_ENV override applied => TARGET_ENV=${env.TARGET_ENV}, RELEASE_TAG=${env.RELEASE_TAG ?: 'none'}"
          }
          // ---------------------------------------

          echo "BRANCH_NAME: ${branch}"
          echo "TAG_NAME: ${tagName ?: 'none'}"
          echo "TARGET_ENV: ${env.TARGET_ENV}"
        }
      }
    }

    stage('Install Deps') {
      steps {
        sh '''
          set -eux
          npm ci
        '''
      }
    }

    stage('Build (Lint/Format)') {
      when { expression { env.TARGET_ENV == "build" } }
      steps {
        sh '''
          set -eux
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
      when { expression { env.TARGET_ENV in ["build", "rc"] } }
      steps {
        sh '''
          set -eux
          npm run test:integration
        '''
      }
    }

    stage('Static Analysis (SonarQube)') {
      when { expression { env.TARGET_ENV == "build" } }
      environment {
        SONAR_PROJECT_KEY = 'order-service'
      }
      steps {
        withSonarQubeEnv('SonarQubeServer') {
          sh '''
            set -eux
            mkdir -p .scannerwork

            sonar-scanner \
              -Dsonar.projectKey="${SONAR_PROJECT_KEY}" \
              -Dsonar.host.url="${SONAR_HOST_URL}" \
              -Dsonar.token="${SONAR_AUTH_TOKEN}" \
              -Dsonar.working.directory=".scannerwork"
          '''
        }
      }
    }

    stage('Quality Gate') {
      when { expression { env.TARGET_ENV == "build" } }
      steps {
          timeout(time: 5, unit: 'MINUTES') {
              waitForQualityGate abortPipeline: true
          }
      }
    }

    stage('Resolve Image Tags') {
      steps {
        script {
          def releaseTag = (env.RELEASE_TAG ?: "").trim()

          if (env.TARGET_ENV == "prod") {
            echo "Resolving production image tag"
            if (!releaseTag) {
              error("Prod build requires a Git tag (RELEASE_TAG).")
            }
            env.IMAGE_TAG = releaseTag
          } else {
            echo "setting image tag to build number"
            env.IMAGE_TAG = "${env.TARGET_ENV}-${env.BUILD_NUMBER}"
          }

          echo "Resolved image tag strategy:"
          echo "  TARGET_ENV  = ${env.TARGET_ENV}"
          echo "  IMAGE_TAG   = ${env.IMAGE_TAG}"
          echo "  RELEASE_TAG = ${releaseTag ?: 'none'}"
          echo "  BUILD_NUMBER= ${env.BUILD_NUMBER}"
        }
      }
    }

    stage('Container Build') {
      steps {
        sh '''
          set -eux
          docker build -f "${DOCKERFILE_PATH}" -t "${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}" .
        '''
      }
    }

    stage('Security Scan (Docker Scout - notify only, mandatory)') {
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
      when { expression { return env.TARGET_ENV in ["dev","staging","prod"] } }
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
        withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG_FILE')]) {
          sh '''
            set -eux
            export KUBECONFIG="$KUBECONFIG_FILE"

            NS=dev
            HOST="order-dev.local"
            OVERLAY="${K8S_DIR}/dev"
            IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"

            # Apply manifests from overlay
            kubectl -n "$NS" apply -f <(kubectl kustomize "$OVERLAY")

            # Inject the image tag produced by Jenkins
            kubectl -n "$NS" set image deployment/order-service order-service="$IMAGE"

            # Wait for rollout
            kubectl -n "$NS" rollout status deployment/order-service --timeout=180s

            # Smoke test via ingress
            ING_URL=$(minikube service -n ingress-nginx ingress-nginx-controller --url | head -n 1)
            curl -fsS -i -H "Host: $HOST" "$ING_URL/health"
          '''
        }
      }
    }

    stage('Deploy (Staging)') {
      when { expression { return env.TARGET_ENV == "staging" } }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG_FILE')]) {
          sh '''
            set -eux
            export KUBECONFIG="$KUBECONFIG_FILE"

            NS=staging
            HOST="order-staging.local"
            OVERLAY="${K8S_DIR}/staging"
            IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"

            kubectl -n "$NS" apply -f <(kubectl kustomize "$OVERLAY")
            kubectl -n "$NS" set image deployment/order-service order-service="$IMAGE"
            kubectl -n "$NS" rollout status deployment/order-service --timeout=180s

            ING_URL=$(minikube service -n ingress-nginx ingress-nginx-controller --url | head -n 1)
            curl -fsS -i -H "Host: $HOST" "$ING_URL/health"
          '''
        }
      }
    }

    stage('Prod Eligibility Check (tag must be on main)') {
      when { expression { return env.TARGET_ENV == "prod" } }
      steps {
        sh '''
          set -eux

          echo "HEAD:"
          git show -s --oneline --decorate HEAD

          echo "Tags pointing at HEAD:"
          git tag --points-at HEAD

          if git tag --points-at HEAD | grep -qx "${TAG_NAME}"; then
            echo "OK: HEAD is correctly tagged with ${TAG_NAME}"
          else
            echo "BLOCK: HEAD is not tagged with ${TAG_NAME}"
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
        withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG_FILE')]) {
          sh '''
            set -eux
            export KUBECONFIG="$KUBECONFIG_FILE"

            NS=prod
            HOST="order-prod.local"
            OVERLAY="${K8S_DIR}/prod"
            IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"

            kubectl -n "$NS" apply -f <(kubectl kustomize "$OVERLAY")
            kubectl -n "$NS" set image deployment/order-service order-service="$IMAGE"
            kubectl -n "$NS" rollout status deployment/order-service --timeout=180s

            ING_URL=$(minikube service -n ingress-nginx ingress-nginx-controller --url | head -n 1)
            curl -fsS -i -H "Host: $HOST" "$ING_URL/health"
          '''
        }
      }
    }
  }

  post {
    always {
      sh '''
        set +e
        echo "post actions will be set later"
      '''
    }
  }
}