pipeline {
  agent { docker { image 'node:22' } }
  options { timestamps() }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Install')  { steps { sh 'npm ci || npm install' } }
    stage('Test') {
      steps { sh 'npm test' }
      post { always { junit allowEmptyResults: true, testResults: 'test-results.xml' } }
    }
    stage('Smoke Test') {
      steps {
        sh '''
          DB_PATH=/tmp/smoke.db PORT=3100 node src/index.js &
          PID=$!
          sleep 3
          curl -fsS http://localhost:3100/api/health
          kill $PID
        '''
      }
    }
  }
  post {
    success { echo 'Backend siap dideploy.' }
    failure { echo 'Pipeline gagal, periksa log.' }
  }
}
