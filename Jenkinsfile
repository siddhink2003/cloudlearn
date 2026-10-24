pipeline {
  agent any
  environment {
    APP_HOST = 'azureuser@<APP_VM_PUBLIC_IP>'
    APP_DIR  = '/var/www/cloudlearn'
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Install')  { steps { sh 'npm ci || npm install' } }
    stage('Test')     { steps { sh 'npm test' } }
    stage('Deploy') {
      steps {
        sshagent(credentials: ['azure-app-vm-key']) {
          sh '''
            rsync -az --delete --exclude node_modules --exclude .env --exclude .git ./ $APP_HOST:$APP_DIR/
            ssh $APP_HOST "cd $APP_DIR && npm ci --omit=dev && pm2 restart cloudlearn || pm2 start server.js --name cloudlearn"
          '''
        }
      }
    }
    stage('Verify') { steps { sh 'sleep 5; curl -fsS http://<APP_VM_PUBLIC_IP>/api/health' } }
  }
  post {
    success { echo 'Deployment succeeded' }
    failure { echo 'Pipeline failed - check the stage logs' }
  }
}
