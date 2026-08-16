/**
 * Ornexa / AVS Gold ERP — Declarative Jenkins Pipeline
 *
 * Environments (configure in Jenkins):
 *   - development: feature branches → validate only
 *   - staging: main/develop → validate + optional staging deploy
 *   - production: approved tags → validate + deploy (manual approval gate)
 *
 * Secrets: use Jenkins Credentials (never commit keys).
 * E2E: stage present but DISABLED until Product Owner enables PLAYWRIGHT_E2E_ENABLED=true
 */
pipeline {
  agent any

  options {
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    timestamps()
    disableConcurrentBuilds(abortPrevious: true)
  }

  environment {
    NODE_VERSION = '22'
    CI = 'true'
    PLAYWRIGHT_E2E_ENABLED = "${env.PLAYWRIGHT_E2E_ENABLED ?: 'false'}"
    DEPLOY_ENV = "${env.DEPLOY_ENV ?: 'none'}"
  }

  parameters {
    choice(
      name: 'PIPELINE_TARGET',
      choices: ['validate-only', 'staging', 'production'],
      description: 'validate-only = no deploy; staging/production require credentials + approval'
    )
    booleanParam(
      name: 'SKIP_DESKTOP_BUILD',
      defaultValue: true,
      description: 'Desktop Electron shell not in repo — skip until electron-app restored'
    )
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.GIT_BRANCH_NAME = env.BRANCH_NAME ?: sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
        }
      }
    }

    stage('Environment Validation') {
      steps {
        sh '''
          set -e
          echo "Branch: ${GIT_BRANCH_NAME}"
          echo "Commit: ${GIT_COMMIT_SHORT}"
          node --version || (echo "Node.js not found — install Node ${NODE_VERSION}" && exit 1)
          npm --version
          test -f package-lock.json || (echo "package-lock.json required for deterministic install" && exit 1)
        '''
      }
    }

    stage('Install Dependencies') {
      steps {
        sh 'npm ci --prefer-offline --no-audit'
      }
    }

    stage('TypeScript') {
      steps {
        sh 'npm run typecheck'
      }
    }

    stage('Lint') {
      steps {
        sh 'npm run lint:ci'
      }
    }

    stage('Security Scan') {
      steps {
        sh 'npm run security:scan'
      }
    }

    stage('Service Verification') {
      steps {
        sh 'npm run test:service'
      }
    }

    stage('Supabase Migration Validation') {
      steps {
        sh 'npm run validate:migrations'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
      post {
        success {
          archiveArtifacts artifacts: 'dist/**/*', fingerprint: true, allowEmptyArchive: false
        }
      }
    }

    stage('Desktop Build') {
      when {
        expression { return !params.SKIP_DESKTOP_BUILD }
      }
      steps {
        sh '''
          if [ -d electron-app ] && [ -f electron-app/package.json ]; then
            cd electron-app && npm ci && npm run package:linux || npm run package:win
          else
            echo "electron-app/ not present — skipping desktop artifact (documented in docs/BUILD_ELECTRON.md)"
          fi
        '''
      }
    }

    stage('E2E Playwright') {
      when {
        expression { return env.PLAYWRIGHT_E2E_ENABLED == 'true' }
      }
      steps {
        sh 'npx playwright install --with-deps chromium'
        sh 'npm run test:e2e'
      }
    }

    stage('Deploy Staging') {
      when {
        allOf {
          expression { return params.PIPELINE_TARGET == 'staging' }
          branch pattern: 'main|develop|staging', comparator: 'REGEXP'
        }
      }
      steps {
        script {
          echo 'Staging deploy — configure DEPLOY_STAGING_SCRIPT or Jenkins deploy step'
          // Example: sh 'bash scripts/deploy-staging.sh'
          // Requires: STAGING_DEPLOY_TOKEN, SUPABASE_URL (non-secret), etc. from Jenkins credentials
        }
      }
    }

    stage('Deploy Production') {
      when {
        expression { return params.PIPELINE_TARGET == 'production' }
      }
      steps {
        timeout(time: 24, unit: 'HOURS') {
          input message: 'Deploy to PRODUCTION?', ok: 'Deploy', submitterParameter: 'APPROVED_BY'
        }
        script {
          echo "Production deploy approved by ${env.APPROVED_BY}"
          // Example: sh 'bash scripts/deploy-production.sh'
        }
      }
    }

    stage('Health Check') {
      when {
        expression { return params.PIPELINE_TARGET in ['staging', 'production'] }
      }
      steps {
        sh '''
          if [ -n "${HEALTH_CHECK_URL}" ]; then
            curl -fsSL "${HEALTH_CHECK_URL}" -o /dev/null || (echo "Health check failed" && exit 1)
            echo "Health check passed: ${HEALTH_CHECK_URL}"
          else
            echo "HEALTH_CHECK_URL not set — skip remote health check"
          fi
        '''
      }
    }
  }

  post {
    success {
      script {
        if (params.PIPELINE_TARGET == 'production') {
          sh 'npm run ci:notify -- --event deploy-success || true'
        }
      }
    }
    failure {
      sh 'npm run ci:notify -- --event build-failed || true'
    }
    always {
      junit allowEmptyResults: true, testResults: '**/test-results/*.xml'
      archiveArtifacts artifacts: 'build_out.txt,dist/**', allowEmptyArchive: true
    }
  }
}
