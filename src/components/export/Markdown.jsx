import React from 'react'
import moment from 'moment'
import ReactDOM from 'react-dom'
import { renderToString } from 'react-dom/server'
import ReactMarkdown from 'react-markdown/with-html'
import { PropTypes, connect, Link, replace, _ } from '../../family'
import { serve } from '../../relatives/services/constant'
import { RModal, Spin } from '../utils'
import { fetchRepository } from '../../actions/repository'
import { GoRepo, GoPencil, GoPlug, GoDatabase, GoJersey, GoLinkExternal, GoFileText } from 'react-icons/lib/go'
import './Markdown.css'

// DONE 2.3 区分请求和响应作用域

class Markdown extends React.Component {

  static propTypes = {
    auth: PropTypes.object.isRequired,
    repository: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired,
  }

  componentDidMount () {
    const id = +this.props.location.params.id
    if (!this.props.repository.data || this.props.repository.data.id !== id) {
      this.props.onFetchRepository({id})
    }
  }

  constructor (props) {
    super(props)
    this.state = {
      showExampleJQuery: false
    }
  }

  // add depth prop
  arrayToTree (list) {
    const parseChildren = (list, parent) => {
      list.forEach(item => {
        if (item.parentId === parent.id) {
          item.depth = parent.depth + 1
          item.children = item.children || []
          // 增加用于排序的标识字段
          item.priority2 = parent.priority2
            ? `${parent.priority2}.${item.priority}`
            : `${parent.priority ? parent.priority + '.' : ''}${item.priority}`
          parent.children.push(item)
          parseChildren(list, item)
        }
      })
      return parent
    }
    return parseChildren(list, {
      id: -1,
      name: 'root',
      children: [],
      depth: -1
    })
  }

  escapeHtml (unsafe) {
    return (unsafe || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  generateMarkdown (data) {
    let md = ''
    let modules = ''
    let menu = ''

    data.modules.forEach((vm, im) => {

      let interfaces = ''
      menu += `- [${im + 2}、${vm.name}](#header-${im + 2})\n`

      vm.interfaces.forEach((vi, ii) => {

        // 根据标识拆解成数组进行排序
        const sortProps = (a, b) => {
          let arrA = a.priority2.split('.')
          let arrB = b.priority2.split('.')

          for (let i = 0; i < Math.max(arrA.length, arrB.length); i++) {
            if (arrA[i] && arrB[i] && +arrA[i] !== +arrB[i]) {
              return +arrA[i] - +arrB[i]
            } else if (arrA[i] && !arrB[i]) {
              return 1
            } else if (!arrA[i] && arrB[i]) {
              return -1
            }
          }
        }

        let requestProps = vi.properties.filter(d => d.scope === 'request')
        this.arrayToTree(requestProps)
        requestProps.sort(sortProps)

        let responseProps = vi.properties.filter(d => d.scope === 'response')
        this.arrayToTree(responseProps)
        responseProps.sort(sortProps)

        console.log(responseProps)

        let request = requestProps.map(v => {
          let pre = '-'.repeat(v.depth || 0)
          return `| ${'<span class="prop-name">'}${pre ? pre + ' ' : ''}${v.name || '&nbsp;'}${'</span>'} | ${v.required ? '是' : '&nbsp;'} | ${v.type || '&nbsp;'} | ${this.escapeHtml(v.description).replace(/\n/g, '<br>') || '&nbsp;'} |\n`
        }).join('')

        let response = responseProps.map(v => {
          let pre = '-'.repeat(v.depth || 0)
          return `| ${'<span class="prop-name">'}${pre ? pre + ' ' : ''}${v.name || '&nbsp;'}${'</span>'} | ${v.type || '&nbsp;'} | ${this.escapeHtml(v.description).replace(/\n/g, '<br>') || '&nbsp;'} |\n`
        }).join('')

        menu += `  - [${im + 2}.${ii + 1}、${vi.name}](#header-${im + 2}-${ii + 1})\n`

        interfaces += `

${'<span id="header-' + (im + 2) + '-' + (ii + 1) + '"></span>'}
### ${im + 2}.${ii + 1}、${vi.name}

${(this.escapeHtml(vi.description) || '').replace(/\n/g, '<br>')}

接口地址：***${vi.url || '-'}***

请求类型：${vi.method}

请求参数：

| 名称 | 必选 | 类型 | 简介 |
| :--- | :---: | :---: | :--- |
${request}

响应内容：

| 名称 | 类型 | 简介 |
| :--- | :---: | :--- |
${response}

响应示例：

略
`

      })

      modules += `

${'<span id="header-' + (im + 2) + '"></span>'}
## ${im + 2}、${vm.name}

${(this.escapeHtml(vm.description) || '').replace(/\n/g, '<br>')}

${interfaces}
`

    })
    md = `# ${data.name}

## 目录

- [1、文档概述](#header-1)
${menu}

${'<span id="header-1"></span>'}
## 1、文档概述

${(this.escapeHtml(data.description || '')).replace(/\n/g, '<br>')}

${modules}

`
    return md
  }

  render () {
    let {location: {params}, auth, repository} = this.props
    if (repository.data.name) {
      document.title = `RAP2 ${repository.data.name}`
    }
    if (!repository.fetching && !repository.data) return <div className='p100 fontsize-40 text-center'>404</div>

    repository = repository.data
    if (!repository.id) return <Spin/>

    let ownerlink = repository.organization
      ? `/organization/repository?organization=${repository.organization.id}`
      : `/repository/joined?user=${repository.owner.id}`

    const markdown = this.generateMarkdown(repository)

    return (
      <section className='Markdown'>
        <div className='header'>
          <span className='title'>
            <GoRepo className='mr6 color-9'/>
            <Link
              to={`${ownerlink}`}>{repository.organization ? repository.organization.name : repository.owner.fullname}</Link>
            <span className='slash'> / </span>
            <span>{repository.name}</span>
            <small> 导出 Markdown</small>
          </span>
        </div>
        <div className="row">
          <div className="col-md-6">
            <h4>Markdown（可以复制到Markdown编辑器中自己调整）</h4>
            <br/>
            <div className="source">
            <pre>
              {markdown}
            </pre>
            </div>
          </div>
          <div className="col-md-6">
            <h4>HTML（可以复制到Word文档）</h4>
            <br/>
            <div className="target">
              <div className="markdown-body">
                <ReactMarkdown
                  source={markdown}
                  escapeHtml={false}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }
}

// 容器组件
const mapStateToProps = (state) => ({
  auth: state.auth,
  repository: state.repository
})
const mapDispatchToProps = ({
  onFetchRepository: fetchRepository,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Markdown)
