pipeline {
  agent any

  environment {
    APP_HOST = 'azureuser@20.196.144.105'
    APP_DIR = '/var/www/cloudlearn'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Test') {
      steps {
        sh 'npm test'
      }
    }

    stage('Deploy with Rollback') {
      steps {
        sshagent(credentials: ['azure-app-vm-key']) {
          sh '''
            set -eu

            # Back up the existing application before deployment.
            ssh "$APP_HOST" 'bash -s' <<'BACKUP'
            set -eu
            APP_DIR=/var/www/cloudlearn
            BACKUP_ROOT=/var/backups/cloudlearn
            STAMP=$(date +%Y%m%d-%H%M%S)
            BACKUP="$BACKUP_ROOT/$STAMP"

            sudo mkdir -p "$BACKUP"
            sudo chown azureuser:azureuser "$BACKUP_ROOT" "$BACKUP"

            rsync -a \
              --exclude=".env" \
              --exclude="public/uploads/" \
              "$APP_DIR/" "$BACKUP/"

            echo "$BACKUP" > "$BACKUP_ROOT/latest"
            echo BACKUP_READY
            BACKUP

            rollback() {
              echo "DEPLOY_FAILED_STARTING_ROLLBACK"

              ssh "$APP_HOST" 'bash -s' <<'RESTORE'
            set -eu
            APP_DIR=/var/www/cloudlearn
            BACKUP=$(cat /var/backups/cloudlearn/latest)

            rsync -a --delete \
              --exclude=".env" \
              --exclude="public/uploads/" \
              "$BACKUP/" "$APP_DIR/"

            cd "$APP_DIR"
            pm2 restart cloudlearn

            for i in $(seq 1 20); do
              if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
                echo ROLLBACK_HEALTH_OK
                exit 0
              fi
              sleep 2
            done

            echo ROLLBACK_HEALTH_FAILED
            exit 1
            RESTORE
            }

            # Copy new files; roll back if copying fails.
            if ! rsync -az \
              --exclude=node_modules \
              --exclude=.env \
              --exclude=public/uploads/ \
              --exclude=.git \
              ./ "$APP_HOST:$APP_DIR/"; then
              rollback || true
              exit 1
            fi

            # Install dependencies, restart, and check health.
            if ssh "$APP_HOST" 'bash -s' <<'DEPLOY'
            set -eu
            cd /var/www/cloudlearn

            npm ci --omit=dev
            pm2 restart cloudlearn --update-env

            for i in $(seq 1 20); do
              if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
                echo DEPLOY_HEALTH_OK
                exit 0
              fi
              sleep 2
            done

            echo DEPLOY_HEALTH_FAILED
            exit 1
            DEPLOY
            then
              echo "Deployment succeeded."
            else
              rollback || true
              exit 1
            fi
          '''
        }
      }
    }
  }

  post {
    success {
      echo 'Deployment succeeded and health check passed.'
    }
    failure {
      echo 'Deployment failed. Check the console output and rollback status.'
    }
  }
}
