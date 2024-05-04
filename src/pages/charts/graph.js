import { useEffect, useRef } from "react";
import * as d3 from "d3";

const width = 1400;
const height = 800;
const marginTop = 50;
const marginRight = 20;
const marginBottom = 40;
const marginLeft = 100;

// 计算持有金值的函数
function calculateHoldingValue(data, initialInvestment, purchaseIndex) {
  // 反转数据（第一行是最后一天）
  data = data.reverse();
  // 找到购买日期的数据
  const purchaseData = data[purchaseIndex];

  // 检查是否找到了购买日期的数据
  if (!purchaseData) {
    throw new Error(`No data found for index: ${purchaseIndex}`);
  }

  // 计算购买的股票数量，取整
  const shares = Math.floor(initialInvestment / purchaseData.Close);

  // 计算每天的持有金值和收益率
  data.forEach((d, index) => {
    if (index >= purchaseIndex) {
      d.holdingValue = d.Close * shares;
      d.returnRate = (d.holdingValue - initialInvestment) / initialInvestment; // 计算收益率
    } else {
      d.holdingValue = 0;
      d.returnRate = 0; // 在购买日期之前，收益率为0
    }
  });

  return data;
}

const Graph = () => {
  const ref = useRef();

  useEffect(() => {
    // 加载.csv文件
    d3.csv("/XiaoMi.csv").then((data) => {
      // 将日期和价格转换为正确的类型
      data.forEach((d) => {
        d.Date = d3.timeParse("%Y-%m-%d")(d.Date);
        d.Close = +d.Close;
      });
      // 初始化收益峰值和亏损峰值
      let maxReturn = -Infinity;
      let minReturn = Infinity;

      // 获取数据的日期范围
      const purchaseIndexStart = 0; // 第一行

      // 计算每天的持有金值
      const holdingData = calculateHoldingValue(
        data,
        100000,
        purchaseIndexStart
      );

      const svg = d3
        .select(ref.current)
        .attr("width", width)
        .attr("height", height);

      const xScale = d3
        .scaleUtc()
        .domain(d3.extent(holdingData, (d) => d.Date))
        .range([marginLeft, width - marginRight]);

      const yScale = d3
        .scaleLog()
        .domain([
          d3.min(holdingData, (d) => d.holdingValue),
          d3.max(holdingData, (d) => d.holdingValue),
        ])
        .range([height - marginBottom, marginTop]);
      // 创建x轴和y轴的网格线
      const xAxisGrid = d3.axisBottom(xScale).tickSize(-height).tickFormat("");
      const yAxisGrid = d3.axisLeft(yScale).tickSize(-width).tickFormat("");

      // 创建一个线生成器
      const line = d3
        .line()
        .x((d) => xScale(d.Date))
        .y((d) => yScale(d.holdingValue))
        .curve(d3.curveMonotoneX); // 设置线的曲率

      // 为每个数据点创建一个小段
      let paths = holdingData.map((d, i) => {
        if (i < holdingData.length - 1) {
          return svg
            .append("path")
            .datum([d, d]) // 初始时，线段的开始点和结束点都是当前数据点
            .attr("fill", "none")
            .attr("stroke", d.holdingValue > 100000 ? "#F23645" : "#089981") // 根据holdingValue的值来设置线段的颜色
            .attr("stroke-width", 3)
            .attr("d", line);
        }
      });

      // 在svg中添加一个圆圈和一个文本元素
      let circle = svg.append("circle").attr("r", 5).attr("fill", "#F23645");

      let text = svg
        .append("text")
        .attr("dx", 10)
        .style("font-weight", "bold")
        .style("font-size", "22px");

      // 创建一个定时器
      let lineTimer = d3.interval((elapsed) => {
        let index = Math.floor(elapsed / 500);
        // 获取最新的数据点
        let latestData = holdingData[index + 1];
        // 更新时间的文本内容
        d3.select("#dateText").text(
          `${d3.timeFormat("%Y-%m-%d")(latestData.Date)}`
        );
        // 更新收益率的文本内容
        d3.select("#returnText")
          .text(`当前收益率：${(latestData.returnRate * 100).toFixed(2)}%`)
          .attr("fill", latestData.returnRate > 0 ? "#F23645" : "#089981");

        if (index < holdingData.length - 1) {
          paths[index]
            .datum([holdingData[index], holdingData[index + 1]]) // 将线段的结束点移动到下一个数据点
            .transition()
            .duration(50) // 设置过渡的持续时间
            .attr("d", line); // 更新线的形状

          // 获取最新的数据点
          let latestData = holdingData[index + 1];

          // 更新圆圈的位置
          circle
            .transition()
            .duration(50)
            .attr("cx", xScale(latestData.Date))
            .attr("cy", yScale(latestData.holdingValue))
            .attr(
              "fill",
              latestData.holdingValue > 100000 ? "#F23645" : "#089981"
            );

          // 更新文本的内容和位置
          text
            .transition()
            .duration(50)
            .attr("x", xScale(latestData.Date) + 10) // 在这里添加一个偏移量
            .attr("y", yScale(latestData.holdingValue))
            .text(Math.floor(latestData.holdingValue)) // 使用Math.floor()函数取整
            .attr(
              "fill",
              latestData.holdingValue > 100000 ? "#F23645" : "#089981"
            );

          // 更新收益峰值和亏损峰值
          if (latestData.returnRate > maxReturn) {
            maxReturn = latestData.returnRate;
            d3.select("#maxReturnText")
              .text(`最高收益：${(maxReturn * 100).toFixed(2)}%`)
              .attr("fill", "#F23645");
          }
          if (latestData.returnRate < minReturn) {
            minReturn = latestData.returnRate;
            d3.select("#minReturnText")
              .text(`最大回撤：${(minReturn * 100).toFixed(2)}%`)
              .attr("fill", "#089981");
          }
        } else {
          lineTimer.stop();
        }
      }, 25); // 设置定时器的间隔时间

      // 添加图表的表头
      svg
        .append("text")
        .attr("x", width / 2) // 设置文本的x坐标为图表的中心
        .attr("y", marginTop) // 设置文本的y坐标为图表的顶部
        .attr("text-anchor", "middle") // 设置文本的锚点为中心，这样文本就会在指定的坐标上居中
        .attr("font-size", "28px") // 设置字体大小
        .attr("font-weight", "bold") // 设置字体粗细
        .text("假如你一年前花 10 万买入小米（港股）"); // 设置文本的内容

      // 添加x轴
      svg
        .append("g")
        .attr("transform", "translate(0," + (height - marginBottom) + ")")
        .attr("font-weight", "bold")
        .call(
          d3
            .axisBottom(xScale)
            .ticks(d3.timeMonth.every(3))
            .tickFormat(d3.timeFormat("%Y-%m"))
        )
        .style("font-size", "20px"); // 设置字体大小为20px

      // 添加y轴
      svg
        .append("g")
        .attr("transform", "translate(" + marginLeft + ",0)")
        .call(d3.axisLeft(yScale))
        .attr("font-weight", "bold")
        .style("font-size", "20px"); // 设置字体大小为20px
      // 添加x轴的网格线
      svg
        .append("g")
        .attr("class", "grid")
        .attr("stroke", "#F2F3F3") // 设置网格线的颜色
        .attr("stroke-opacity", "0.1") // 设置网格线的透明度
        .attr(
          "transform",
          "translate(" + marginLeft + "," + (height + marginTop) + ")"
        )
        .call(xAxisGrid);

      // 添加y轴的网格线
      svg
        .append("g")
        .attr("class", "grid")
        .attr("stroke", "#F2F3F3") // 设置网格线的颜色
        .attr("stroke-opacity", "0.1") // 设置网格线的透明度
        .attr("transform", "translate(" + marginLeft + "," + marginTop + ")")
        .call(yAxisGrid);
      // 添加时间的文本元素
      svg
        .append("text")
        .attr("id", "dateText") // 设置id，以便后续更新文本的内容
        .attr("x", width - marginRight) // 设置文本的x坐标为图表的右边
        .attr("y", marginTop + 10) // 设置文本的y坐标为图表的顶部
        .attr("text-anchor", "end") // 设置文本的锚点为结束，这样文本就会在指定的坐标上右对齐
        .attr("font-size", "20px") // 设置字体大小
        .attr("font-weight", "bold") // 设置字体粗细
        .text(""); // 初始时，文本的内容为空

      // 添加收益率的文本元素
      svg
        .append("text")
        .attr("id", "returnText") // 设置id，以便后续更新文本的内容
        .attr("x", width - marginRight) // 设置文本的x坐标为图表的右边
        .attr("y", marginTop + 40) // 设置文本的y坐标为图表的顶部，再向下偏移20像素
        .attr("text-anchor", "end") // 设置文本的锚点为结束，这样文本就会在指定的坐标上右对齐
        .attr("font-size", "20px") // 设置字体大小
        .attr("font-weight", "bold") // 设置字体粗细
        .text(""); // 初始时，文本的内容为空

      // 添加收益峰值的文本元素
      svg
        .append("text")
        .attr("id", "maxReturnText") // 设置id，以便后续更新文本的内容
        .attr("x", width - marginRight) // 设置文本的x坐标为图表的右边
        .attr("y", marginTop + 640) // 设置文本的y坐标为图表的顶部，再向下偏移50像素
        .attr("text-anchor", "end") // 设置文本的锚点为结束，这样文本就会在指定的坐标上右对齐
        .attr("font-size", "20px") // 设置字体大小
        .attr("font-weight", "bold") // 设置字体粗细
        .text(""); // 初始时，文本的内容为空

      // 添加亏损峰值的文本元素
      svg
        .append("text")
        .attr("id", "minReturnText") // 设置id，以便后续更新文本的内容
        .attr("x", width - marginRight) // 设置文本的x坐标为图表的右边
        .attr("y", marginTop + 670) // 设置文本的y坐标为图表的顶部，再向下偏移80像素
        .attr("text-anchor", "end") // 设置文本的锚点为结束，这样文本就会在指定的坐标上右对齐
        .attr("font-size", "20px") // 设置字体大小
        .attr("font-weight", "bold") // 设置字体粗细
        .text(""); // 初始时，文本的内容为空

      return () => {
        // 当组件卸载时，停止定时器
        timer.stop();
      };
    });
  }, []);

  return <svg ref={ref} />;
};

export default Graph;
